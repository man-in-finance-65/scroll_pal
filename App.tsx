import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { askPal } from './src/pal';
import { getGeminiKey, loadPods, savePods, setGeminiKey } from './src/storage';
import { Pod } from './src/types';

type Screen = { name: 'home' } | { name: 'new' } | { name: 'pod'; id: string } | { name: 'settings' };

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export default function App() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [pods, setPods] = useState<Pod[]>([]);

  useEffect(() => {
    loadPods().then(setPods);
  }, []);

  const updatePods = (next: Pod[]) => {
    setPods(next);
    savePods(next);
  };

  const home = () => setScreen({ name: 'home' });

  return (
    <SafeAreaProvider>
    <SafeAreaView style={s.root}>
      <StatusBar style="dark" />
      {screen.name === 'home' && (
        <Home
          pods={pods}
          onNew={() => setScreen({ name: 'new' })}
          onOpen={(id) => setScreen({ name: 'pod', id })}
          onSettings={() => setScreen({ name: 'settings' })}
        />
      )}
      {screen.name === 'new' && (
        <NewPod
          onCancel={home}
          onCreated={(pod) => {
            updatePods([pod, ...pods]);
            setScreen({ name: 'pod', id: pod.id });
          }}
        />
      )}
      {screen.name === 'pod' && (
        <PodView
          pod={pods.find((p) => p.id === screen.id)}
          onBack={home}
          onChange={(pod) => updatePods(pods.map((p) => (p.id === pod.id ? pod : p)))}
          onDelete={(id) => {
            updatePods(pods.filter((p) => p.id !== id));
            home();
          }}
        />
      )}
      {screen.name === 'settings' && <Settings onBack={home} />}
    </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Header({ title, left, right }: { title: string; left?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <View style={s.headerSide}>{left}</View>
      <Text style={s.headerTitle}>{title}</Text>
      <View style={[s.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10}>
      <Text style={s.link}>{label}</Text>
    </Pressable>
  );
}

function Button({ label, onPress, kind = 'primary', disabled }: {
  label: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary';
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[s.button, kind === 'secondary' && s.buttonSecondary, disabled && { opacity: 0.5 }]}
    >
      <Text style={[s.buttonText, kind === 'secondary' && s.buttonTextSecondary]}>{label}</Text>
    </Pressable>
  );
}

function Home({ pods, onNew, onOpen, onSettings }: {
  pods: Pod[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onSettings: () => void;
}) {
  return (
    <View style={s.flex}>
      <Header title="ScrollPal" right={<Link label="Settings" onPress={onSettings} />} />
      {pods.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>Turn a reel into a plan</Text>
          <Text style={s.muted}>
            Saw a recipe, workout or tip while scrolling? Paste the link, caption or a screenshot and Pal turns
            it into steps and a shopping list.
          </Text>
        </View>
      ) : (
        <FlatList
          data={pods}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          renderItem={({ item }) => {
            const done = item.tasks.filter((t) => t.done).length;
            return (
              <Pressable style={s.card} onPress={() => onOpen(item.id)}>
                <Text style={s.tag}>{item.category.toUpperCase()}</Text>
                <Text style={s.cardTitle}>{item.title}</Text>
                <Text style={s.muted} numberOfLines={2}>{item.summary}</Text>
                <Text style={s.progress}>{done}/{item.tasks.length} done</Text>
              </Pressable>
            );
          }}
        />
      )}
      <View style={s.footer}>
        <Button label="+ New Pod from a reel" onPress={onNew} />
      </View>
    </View>
  );
}

function NewPod({ onCancel, onCreated }: { onCancel: () => void; onCreated: (pod: Pod) => void }) {
  const [url, setUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [image, setImage] = useState<{ uri: string; base64: string; mimeType: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const pasteLink = async () => setUrl((await Clipboard.getStringAsync()).trim());

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      base64: true,
      quality: 0.6,
    });
    const asset = result.assets?.[0];
    if (!result.canceled && asset?.base64) {
      setImage({ uri: asset.uri, base64: asset.base64, mimeType: asset.mimeType ?? 'image/jpeg' });
    }
  };

  const submit = async () => {
    const apiKey = await getGeminiKey();
    if (!apiKey) {
      Alert.alert('Add your Gemini key', 'Open Settings and paste your Gemini API key first.');
      return;
    }
    setBusy(true);
    try {
      const r = await askPal({
        apiKey,
        onStatus: setStatus,
        url: url || undefined,
        caption: caption || undefined,
        image: image ? { base64: image.base64, mimeType: image.mimeType } : undefined,
      });
      onCreated({
        id: newId(),
        createdAt: Date.now(),
        sourceUrl: url || undefined,
        title: r.title,
        summary: r.summary,
        category: r.category,
        tasks: r.tasks.map((text) => ({ id: newId(), text, done: false })),
        shoppingList: r.shoppingList,
      });
    } catch (e) {
      Alert.alert('Pal got stuck', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const hasInput = Boolean(url || caption || image);

  return (
    <View style={s.flex}>
      <Header title="New Pod" left={<Link label="Cancel" onPress={onCancel} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={s.label}>Reel link</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TextInput
            style={[s.input, s.flex]}
            value={url}
            onChangeText={setUrl}
            placeholder="https://instagram.com/reel/..."
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button label="Paste" kind="secondary" onPress={pasteLink} />
        </View>
        <Text style={s.label}>Caption or what the reel says</Text>
        <TextInput
          style={[s.input, { minHeight: 110, textAlignVertical: 'top' }]}
          value={caption}
          onChangeText={setCaption}
          placeholder="Paste the caption, or describe the reel in a sentence"
          multiline
        />
        <Text style={s.label}>Screenshot (optional)</Text>
        {image && <Image source={{ uri: image.uri }} style={s.preview} />}
        <Button label={image ? 'Change screenshot' : 'Add screenshot'} kind="secondary" onPress={pickImage} />
        <Text style={s.hint}>Pal reads the caption and screenshot. A link alone gives a rough guess.</Text>
      </ScrollView>
      <View style={s.footer}>
        {busy ? (
          <View style={{ alignItems: 'center', gap: 8 }}>
            <ActivityIndicator size="large" />
            <Text style={s.hint}>{status || 'Pal is reading your reel…'}</Text>
          </View>
        ) : (
          <Button label="Ask Pal" onPress={submit} disabled={!hasInput} />
        )}
      </View>
    </View>
  );
}

function PodView({ pod, onBack, onChange, onDelete }: {
  pod?: Pod;
  onBack: () => void;
  onChange: (pod: Pod) => void;
  onDelete: (id: string) => void;
}) {
  if (!pod) return <Header title="Not found" left={<Link label="Back" onPress={onBack} />} />;

  const toggle = (id: string) =>
    onChange({ ...pod, tasks: pod.tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)) });

  const listText = pod.shoppingList.map((i) => `- ${i}`).join('\n');

  const confirmDelete = () =>
    Alert.alert('Delete this Pod?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(pod.id) },
    ]);

  return (
    <View style={s.flex}>
      <Header title="Pod" left={<Link label="Back" onPress={onBack} />} right={<Link label="Delete" onPress={confirmDelete} />} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={s.tag}>{pod.category.toUpperCase()}</Text>
        <Text style={s.title}>{pod.title}</Text>
        <Text style={s.body}>{pod.summary}</Text>
        {pod.sourceUrl && <Link label="Open original reel" onPress={() => Linking.openURL(pod.sourceUrl!)} />}

        <Text style={s.section}>Do it</Text>
        {pod.tasks.map((t) => (
          <Pressable key={t.id} style={s.task} onPress={() => toggle(t.id)}>
            <View style={[s.check, t.done && s.checkOn]}>{t.done && <Text style={s.checkMark}>✓</Text>}</View>
            <Text style={[s.body, s.flex, t.done && s.doneText]}>{t.text}</Text>
          </Pressable>
        ))}

        {pod.shoppingList.length > 0 && (
          <>
            <Text style={s.section}>Shopping list</Text>
            {pod.shoppingList.map((item) => (
              <View key={item} style={s.shopRow}>
                <Text style={[s.body, s.flex]}>• {item}</Text>
                <Link
                  label="Instacart"
                  onPress={() => Linking.openURL(`https://www.instacart.com/store/s?k=${encodeURIComponent(item)}`)}
                />
              </View>
            ))}
            <Button
              label="Copy shopping list"
              kind="secondary"
              onPress={async () => {
                await Clipboard.setStringAsync(listText);
                Alert.alert('Copied', 'Paste it into your notes or grocery app.');
              }}
            />
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Settings({ onBack }: { onBack: () => void }) {
  const [key, setKey] = useState('');

  useEffect(() => {
    getGeminiKey().then(setKey);
  }, []);

  return (
    <View style={s.flex}>
      <Header title="Settings" left={<Link label="Back" onPress={onBack} />} />
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={s.label}>Gemini API key</Text>
        <TextInput
          style={s.input}
          value={key}
          onChangeText={setKey}
          placeholder="Paste from aistudio.google.com/apikey"
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
        <Text style={s.hint}>Stored only on this phone.</Text>
        <Button
          label="Save"
          onPress={async () => {
            await setGeminiKey(key);
            onBack();
          }}
        />
      </View>
    </View>
  );
}

const PURPLE = '#6C47FF';

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F7F6FB' },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  headerSide: { width: 80 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 17, fontWeight: '700' },
  link: { color: PURPLE, fontSize: 16, fontWeight: '600' },
  button: { backgroundColor: PURPLE, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center' },
  buttonSecondary: { backgroundColor: '#ECE8FF' },
  buttonText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  buttonTextSecondary: { color: PURPLE },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: '#DDD', backgroundColor: '#FFF' },
  empty: { flex: 1, justifyContent: 'center', padding: 32, gap: 8 },
  emptyTitle: { fontSize: 22, fontWeight: '800', textAlign: 'center' },
  muted: { color: '#666', fontSize: 15, lineHeight: 21, textAlign: 'left' },
  card: { backgroundColor: '#FFF', borderRadius: 14, padding: 16, gap: 4 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  tag: { color: PURPLE, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  progress: { marginTop: 6, color: '#999', fontSize: 13 },
  label: { fontSize: 14, fontWeight: '700', color: '#333' },
  input: { backgroundColor: '#FFF', borderRadius: 10, borderWidth: 1, borderColor: '#DDD', padding: 12, fontSize: 16 },
  hint: { color: '#888', fontSize: 13 },
  preview: { width: '100%', height: 220, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#EEE' },
  title: { fontSize: 26, fontWeight: '800' },
  body: { fontSize: 16, lineHeight: 22, color: '#222' },
  section: { marginTop: 12, fontSize: 18, fontWeight: '800' },
  task: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFF', padding: 14, borderRadius: 12 },
  check: { width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: PURPLE, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: PURPLE },
  checkMark: { color: '#FFF', fontWeight: '900' },
  doneText: { color: '#999', textDecorationLine: 'line-through' },
  shopRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
});
