import { Column, Text, Spacer } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { SleepWidgetProps } from '@/lib/widgets-state';

const SleepStatus = (props: SleepWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const light = props.themeMode === 'Sunset' || (props.themeMode === 'System' && environment.colorScheme === 'light');
  const surface = light ? '#F3F5F8' : '#101D2B';
  const text = light ? '#182636' : '#F4F7FC';
  const secondary = light ? '#47576B' : '#B7C6D9';
  const accent = props.colorPalette === 'Amethyst' ? (light ? '#6241A6' : '#C8AEFF') : (light ? '#00677E' : '#73DBEE');
  return (
    <Column modifiers={[fillMaxSize(), background(surface), cornerRadius(24), paddingAll(16)]}>
      <Text color={accent} style={{ fontSize: 12, fontWeight: 'medium' }} maxLines={1}>{props.demo ? 'TWILIGHT / DEMO' : 'TWILIGHT / SLEEP'}</Text>
      <Spacer modifiers={[height(10)]} />
      <Text color={text} style={{ fontSize: 22, fontWeight: 'bold' }} maxLines={2}>{props.status}</Text>
      <Text color={secondary} style={{ fontSize: 12 }} maxLines={2}>{props.statusDetail}</Text>
      <Spacer modifiers={[height(12)]} />
      <Text color={accent} style={{ fontSize: 14, fontWeight: 'medium' }} maxLines={1}>{`Goal ${props.goal}`}</Text>
      <Text color={secondary} style={{ fontSize: 12 }} maxLines={1}>{props.target}</Text>
      <Spacer modifiers={[height(10)]} />
      <Text color={secondary} style={{ fontSize: 11 }} maxLines={1}>Open Twilight to start or finish</Text>
    </Column>
  );
};

export default createWidget('TwilightSleepStatus', SleepStatus, {
  status: 'Welcome to Twilight', statusDetail: 'Open Twilight to load your sleep data', goal: 'Set in app', target: 'Your sleep schedule',
  latestLabel: '', latestDuration: '', weeklyAverage: '', weeklyDetail: '', weeklyRange: '', demo: false, themeMode: 'System', colorPalette: 'Twilight',
});
