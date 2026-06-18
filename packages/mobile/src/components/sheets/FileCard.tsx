import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';

type Props = {
  name: string;
  path: string;
  size?: string;
  /** 文件类型，决定缩略图颜色：'img' (蓝渐变) | 'pdf' (紫) | 'xls' (绿) | 'default' (蓝) */
  fileType?: 'img' | 'pdf' | 'xls' | 'default';
  testID?: string;
};

/**
 * 附件面板"最近使用"文件卡片
 * 设计稿 attachment.html：
 *   - 40×40 圆角 8px 缩略图
 *   - IMG: linear-gradient(135deg, #4A8BFF, #1A66FF) + 白色 "IMG"
 *   - PDF: #F0E7FE 紫底 + #8B5CF6 紫字 "PDF"
 *   - XLS: #E1F4E9 绿底 + #34A853 绿字 "XLS"
 *   - 文件名 13px/500、meta 11px/fg3、time 11px/fg3
 */
export function FileCard({ name, path, size, fileType = 'default', testID }: Props) {
  const { tokens } = useTheme();

  const typeConfig = {
    img: { label: 'IMG', bgColor: 'url(#fcImgGrad)', textColor: '#FFFFFF' },
    pdf: { label: 'PDF', bgColor: '#F0E7FE', textColor: '#8B5CF6' },
    xls: { label: 'XLS', bgColor: '#E1F4E9', textColor: '#34A853' },
    default: { label: 'FILE', bgColor: '#1A66FF', textColor: '#FFFFFF' },
  } as const;

  const config = typeConfig[fileType];

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: '#F5F5F7',
        borderRadius: 12,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: fileType === 'img' ? '#1A66FF' : config.bgColor,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {fileType === 'img' && (
          <Svg
            width={40}
            height={40}
            viewBox="0 0 40 40"
            style={{ position: 'absolute', top: 0, left: 0 }}
            pointerEvents="none"
          >
            <Defs>
              <LinearGradient id="fcImgGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#4A8BFF" />
                <Stop offset="1" stopColor="#1A66FF" />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={0} width={40} height={40} rx={8} ry={8} fill="url(#fcImgGrad)" />
          </Svg>
        )}
        <Text
          style={{
            color: config.textColor,
            fontSize: fileType === 'img' ? 10 : 11,
            fontWeight: '700',
          }}
        >
          {config.label}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: tokens.fontSize.sm, fontWeight: '500', color: '#1C1C1E' }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{ fontSize: tokens.fontSize.xs, color: '#8E8E93', marginTop: 1 }}
          numberOfLines={1}
        >
          {path}
        </Text>
      </View>
      {size && (
        <Text style={{ fontSize: tokens.fontSize.xs, color: '#8E8E93' }}>{size}</Text>
      )}
    </View>
  );
}
