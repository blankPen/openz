import 'react-native-get-random-values';
import '../src/i18n'; // initialize i18n
import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/ThemeProvider';
import { getSocket } from '../src/lib/socket';
import { _setupSocketConnection } from '../src/hooks/useSocket';

const STALE_TIME = 30 * 1000;

/** 安装 socket 连接监听（connect/error/disconnect → connectionStore） */
function SocketInitializer() {
  useEffect(() => {
    _setupSocketConnection(getSocket());
  }, []);
  return null;
}

export default function RootLayout() {
  // QueryClient 单例（在 useState 工厂里确保整个 app 只有一个实例）
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_TIME,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <SocketInitializer />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
          </Stack>
          <ExpoStatusBar style="auto" />
        </QueryClientProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
