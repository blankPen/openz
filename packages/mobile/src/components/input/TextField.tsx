import { useState, useCallback } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = Omit<TextInputProps, 'multiline' | 'onContentSizeChange'> & {
  minHeight?: number;
  maxHeight?: number;
};

export function TextField({ minHeight = 24, maxHeight = 100, style, onChange, ...rest }: Props) {
  const { palette } = useTheme();
  const [height, setHeight] = useState(minHeight);

  const onContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const next = Math.min(Math.max(e.nativeEvent.contentSize.height, minHeight), maxHeight);
      setHeight(next);
    },
    [minHeight, maxHeight],
  );

  return (
    <TextInput
      multiline
      onContentSizeChange={onContentSizeChange}
      placeholderTextColor={palette.fg3}
      style={[
        {
          minHeight,
          maxHeight,
          fontSize: 15,
          lineHeight: 21,
          color: palette.fg,
          padding: 0,
          textAlignVertical: 'top',
        },
        { height },
        style,
      ]}
      {...rest}
    />
  );
}
