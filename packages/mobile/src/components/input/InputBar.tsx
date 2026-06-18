import { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import { TextField } from './TextField';
import { MicButton } from './MicButton';
import { PlusButton } from './PlusButton';
import { SendButton } from './SendButton';

type Props = {
  onSend?: (text: string) => void;
  onStop?: () => void;
  onAttachment?: () => void;
  onMic?: () => void;
  /** 流式输出中:把发送按钮换成"停止"按钮 */
  isStreaming?: boolean;
  /** 输入框 disabled（流式时仍可继续输入但不能发） */
  disabled?: boolean;
};

/**
 * 底部输入区
 * 设计稿 home.html / conversation.html：
 *   - 外层 12px / 8px 4px 内边距
 *   - 圆角 16px、底色 #F2F2F2 的输入框，10px/12px/8px 内边距，min-height 56
 *   - 输入行底部 8px gap，水平布局：左侧 mic，右侧 plus + send（圆形蓝色填充）
 *
 * 流式状态(isStreaming=true):
 *   - 发送按钮换成"停止"按钮
 *   - 输入框 disabled
 *   - 点击 onStop() 中断流式
 */
export function InputBar({ onSend, onStop, onAttachment, onMic, isStreaming, disabled }: Props) {
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
          placeholder={isStreaming ? '正在生成...' : '尽管问，带图也行'}
          accessibilityLabel="消息输入框"
          editable={!disabled && !isStreaming}
        />
        <View style={styles.inputActionsRow}>
          <View style={styles.inputActionLeft}>
            {text.trim() || isStreaming ? null : (
              <MicButton onPress={onMic} accessibilityLabel="语音输入" />
            )}
          </View>
          <View style={styles.inputActionRight} testID="input-actions-right">
            <PlusButton onPress={onAttachment} testID="plus-button" />
            {isStreaming ? (
              <Pressable
                onPress={onStop}
                style={({ pressed }) => [
                  styles.stopButton,
                  pressed && styles.stopButtonPressed,
                ]}
                testID="stop-button"
                accessibilityLabel="停止生成"
              >
                <Text style={styles.stopText}>■</Text>
              </Pressable>
            ) : (
              <SendButton
                onPress={handleSend}
                disabled={!text.trim()}
                testID="send-button"
                accessibilityLabel="发送消息"
              />
            )}
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
  stopButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stopButtonPressed: {
    opacity: 0.7,
  },
  stopText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
