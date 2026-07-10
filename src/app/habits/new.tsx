import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors, MaxContentWidth, Palette, Spacing } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import type { HabitType } from '@/lib/habits';
import { dateToTimeString, format12h, timeStringToDate } from '@/lib/time';
import { useHabits } from '@/lib/use-habits';

const EMOJI_CHOICES = ['💧', '📚', '🏃', '🧘', '🥗', '💪', '🌱', '✍️', '🛌', '🎯', '🤸', '🎨'];

export default function HabitForm() {
  const router = useRouter();
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { getHabit, addHabit, updateHabit } = useHabits();
  const scheme = useColorScheme();
  const palette = Colors[scheme === 'unspecified' ? 'light' : scheme];

  const existing = editId ? getHabit(editId) : undefined;

  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[0]);
  const [type, setType] = useState<HabitType>('binary');
  const [target, setTarget] = useState(3);
  const [reminderTime, setReminderTime] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerValue, setPickerValue] = useState<Date>(timeStringToDate(null));

  useEffect(() => {
    if (!existing) return;
    setName(existing.name);
    setEmoji(existing.emoji);
    setType(existing.type);
    setTarget(existing.target);
    setReminderTime(existing.reminderTime);
  }, [existing]);

  const canSave = name.trim().length > 0;

  function handleSave() {
    if (!canSave) return;
    if (existing) {
      updateHabit(existing.id, { name, emoji, type, target, reminderTime });
    } else {
      addHabit({ name, emoji, type, target, reminderTime });
    }
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled">
          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            NAME
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Meditate 10 min"
            placeholderTextColor={palette.textSecondary}
            returnKeyType="done"
            style={[
              styles.input,
              {
                color: palette.text,
                backgroundColor: palette.backgroundElement,
                borderColor: palette.backgroundSelected,
              },
            ]}
          />

          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            ICON
          </ThemedText>
          <View style={styles.chipRow}>
            {EMOJI_CHOICES.map((e) => {
              const selected = e === emoji;
              return (
                <Pressable
                  key={e}
                  onPress={() => setEmoji(e)}
                  style={[
                    styles.emojiChip,
                    {
                      backgroundColor: selected ? palette.backgroundSelected : palette.backgroundElement,
                      borderColor: selected ? palette.text : palette.backgroundSelected,
                    },
                  ]}>
                  <ThemedText style={{ fontSize: 22, lineHeight: 26 }}>{e}</ThemedText>
                </Pressable>
              );
            })}
          </View>

          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            TYPE
          </ThemedText>
          <View style={styles.typeRow}>
            <TypeCard
              active={type === 'binary'}
              onPress={() => setType('binary')}
              title="Once a day"
              subtitle="Check it off"
              palette={palette}
            />
            <TypeCard
              active={type === 'count'}
              onPress={() => setType('count')}
              title="Volume"
              subtitle="Log a target N times"
              palette={palette}
            />
          </View>

          {type === 'count' && (
            <View>
              <ThemedText type="small" style={{ color: palette.textSecondary }}>
                DAILY TARGET
              </ThemedText>
              <View style={styles.targetRow}>
                <Pressable
                  onPress={() => setTarget((t) => Math.max(1, t - 1))}
                  style={[styles.targetBtn, { borderColor: palette.backgroundSelected }]}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '600' }}>−</ThemedText>
                </Pressable>
                <View style={styles.targetBubble}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>{target}</ThemedText>
                  <ThemedText type="small" style={{ color: palette.textSecondary }}>
                    times / day
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setTarget((t) => Math.min(20, t + 1))}
                  style={[styles.targetBtn, { borderColor: palette.backgroundSelected }]}>
                  <ThemedText style={{ fontSize: 22, fontWeight: '600' }}>+</ThemedText>
                </Pressable>
              </View>
            </View>
          )}

          <ThemedText type="small" style={{ color: palette.textSecondary }}>
            REMINDER
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.reminderCard}>
            <View style={styles.reminderRow}>
              <View style={{ flexShrink: 1 }}>
                <ThemedText style={{ fontSize: 15, fontWeight: '600' }}>Daily reminder</ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary }}>
                  {reminderTime ? `at ${format12h(reminderTime)}` : 'off'}
                </ThemedText>
              </View>
              <Switch
                value={!!reminderTime}
                onValueChange={(on) => {
                  if (on) {
                    const initial = timeStringToDate(reminderTime ?? '09:00');
                    setPickerValue(initial);
                    setReminderTime(dateToTimeString(initial));
                    if (Platform.OS === 'android') setPickerOpen(true);
                  } else {
                    setReminderTime(null);
                  }
                }}
                trackColor={{ true: palette.text, false: palette.backgroundSelected }}
                thumbColor={palette.background}
              />
            </View>

            {reminderTime && (
              <Pressable
                onPress={() => {
                  setPickerValue(timeStringToDate(reminderTime));
                  setPickerOpen(true);
                }}
                style={({ pressed }) => [
                  styles.timeBtn,
                  {
                    borderColor: palette.text,
                    backgroundColor: palette.background,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}>
                <ThemedText style={{ fontSize: 22, fontWeight: '700' }}>
                  {format12h(reminderTime)}
                </ThemedText>
                <ThemedText type="small" style={{ color: palette.textSecondary, marginTop: 2 }}>
                  Tap to change
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>

          {Platform.OS === 'ios' && (
            <Modal transparent visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
              <Pressable style={styles.modalBackdrop} onPress={() => setPickerOpen(false)}>
                <Pressable
                  onPress={(e) => e.stopPropagation()}
                  style={[styles.modalSheet, { backgroundColor: palette.background }]}>
                  <View style={styles.modalHeader}>
                    <ThemedText style={{ fontWeight: '600', fontSize: 16 }}>Pick a time</ThemedText>
                    <Pressable onPress={() => setPickerOpen(false)}>
                      <ThemedText style={{ fontWeight: '700', color: palette.text }}>Done</ThemedText>
                    </Pressable>
                  </View>
                  <DateTimePicker
                    mode="time"
                    display="spinner"
                    value={pickerValue}
                    onChange={(_, d) => {
                      if (d) {
                        setPickerValue(d);
                        setReminderTime(dateToTimeString(d));
                      }
                    }}
                  />
                </Pressable>
              </Pressable>
            </Modal>
          )}

          {Platform.OS === 'android' && pickerOpen && (
            <DateTimePicker
              mode="time"
              display="clock"
              value={pickerValue}
              is24Hour={false}
              onChange={(_, d) => {
                setPickerOpen(false);
                if (d) {
                  setPickerValue(d);
                  setReminderTime(dateToTimeString(d));
                }
              }}
            />
          )}

          <Pressable
            onPress={handleSave}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.saveBtn,
              {
                backgroundColor: palette.text,
                opacity: !canSave ? 0.4 : pressed ? 0.85 : 1,
              },
            ]}>
            <ThemedText style={{ color: palette.background, fontWeight: '700', fontSize: 16 }}>
              {existing ? 'Save changes' : 'Add habit'}
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function TypeCard({
  active,
  onPress,
  title,
  subtitle,
  palette,
}: {
  active: boolean;
  onPress: () => void;
  title: string;
  subtitle: string;
  palette: Palette;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.typeCard,
        {
          backgroundColor: active ? palette.backgroundSelected : palette.backgroundElement,
          borderColor: active ? palette.text : palette.backgroundSelected,
        },
      ]}>
      <ThemedText style={{ fontSize: 15, fontWeight: '700' }}>{title}</ThemedText>
      <ThemedText type="small" style={{ color: palette.textSecondary }}>
        {subtitle}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    padding: Spacing.three,
    gap: Spacing.two,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
    paddingBottom: Spacing.six,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  emojiChip: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reminderCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    gap: Spacing.two,
  },
  reminderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  timeBtn: {
    borderWidth: 1.5,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.four,
    paddingTop: Spacing.three,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.two,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  typeCard: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1.5,
    gap: 2,
  },
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  targetBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  targetBubble: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two,
  },
  saveBtn: {
    marginTop: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.two,
    alignItems: 'center',
  },
});
