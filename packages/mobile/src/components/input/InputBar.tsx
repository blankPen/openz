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

/**
 * 底部输入区
 * 设计稿 home.html / conversation.html：
 *   - 外层 12px / 8px 4px 内边距
 *   - 圆角 16px、底色 #F2F2F2 的输入框，10px/12px/8px 内边距，min-height 56
 *   - 输入行底部 8px gap，水平布局：左侧 mic，右侧 plus + send（圆形蓝色填充）
 */
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
        <View style={styles.inputActionsRow}>
          <View style={styles.inputActionLeft}>
            {text.trim() ? null : (
              <MicButton onPress={onMic} accessibilityLabel="语音输入" />
            )}
          </View>
          <View style={styles.inputActionRight} testID="input-actions-right">
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
  },
  inputBox: {
    backgroundColor: '#F2F2F2',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
    minHeight: 56,
  },
  inputActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  inputActionLeft: {
    marginRight: 'auto',
  },
  inputActionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
