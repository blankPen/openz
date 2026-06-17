import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextField } from './TextField';
import { MicButton } from './MicButton';
import { AttachmentButton } from './AttachmentButton';
import { SendButton } from './SendButton';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  onSend?: (text: string) => void;
  onAttachment?: () => void;
  onMic?: () => void;
};

export function InputBar({ onSend, onAttachment, onMic }: Props) {
  const { palette } = useTheme();
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
  }, [text, onSend]);

  return (
    <View style={[styles.container, { backgroundColor: palette.surface, borderTopColor: palette.border }]}>
      <AttachmentButton onPress={onAttachment} testID="attachment-button" />
      <View style={styles.inputWrapper}>
        <TextField
          value={text}
          onChangeText={setText}
          placeholder="输入消息..."
          accessibilityLabel="消息输入框"
        />
      </View>
      {text.trim() ? (
        <SendButton onPress={handleSend} accessibilityLabel="发送消息" />
      ) : (
        <MicButton onPress={onMic} accessibilityLabel="语音输入" />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  inputWrapper: {
    flex: 1,
  },
});
