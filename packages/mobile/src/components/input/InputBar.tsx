import { useState, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { TextField } from './TextField';
import { MicButton } from './MicButton';
import { PlusButton } from './PlusButton';
import { SendButton } from './SendButton';

type Props = {
  onSend?: (text: string) => void;
  onAttachment?: () => void;
  onMic?: () => void;
};

export function InputBar({ onSend, onAttachment, onMic }: Props) {
  const [text, setText] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend?.(trimmed);
    setText('');
  }, [text, onSend]);

  return (
    <View style={styles.container} testID="input-bar-container">
      <View style={styles.inputBox} testID="input-box">
        <TextField
          value={text}
          onChangeText={setText}
          placeholder="尽管问，带图也行"
          accessibilityLabel="消息输入框"
        />
      </View>
      <View style={styles.inputActionsRow}>
        {text.trim() ? null : <MicButton onPress={onMic} accessibilityLabel="语音输入" />}
        <View style={styles.inputActionsRight} testID="input-actions-right">
          <PlusButton onPress={onAttachment} testID="plus-button" />
          <SendButton
            onPress={handleSend}
            disabled={!text.trim()}
            testID="send-button"
            accessibilityLabel="发送消息"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    padding: 10,
    minHeight: 56,
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  inputActionsRight: {
    flexDirection: 'column',
    gap: 8,
  },
});
