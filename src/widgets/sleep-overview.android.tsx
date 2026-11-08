import { Column, Text, Spacer } from '@expo/ui/jetpack-compose';
import { background, cornerRadius, fillMaxSize, height, paddingAll } from '@expo/ui/jetpack-compose/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import type { SleepWidgetProps } from '@/lib/widgets-state';

const SleepOverview = (props: SleepWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const light = props.themeMode === 'Sunset' || (props.themeMode === 'System' && environment.colorScheme === 'light');
  const text = light ? '#182636' : '#F4F7FC';
  const secondary = light ? '#47576B' : '#B7C6D9';
  const accent = props.colorPalette === 'Amethyst' ? (light ? '#6241A6' : '#C8AEFF') : (light ? '#00677E' : '#73DBEE');
  return (
    <Column modifiers={[fillMaxSize(), background(light ? '#F3F5F8' : '#101D2B'), cornerRadius(24), paddingAll(16)]}>
      <Text color={accent} style={{ fontSize: 12, fontWeight: 'medium' }} maxLines={1}>{props.demo ? 'TWILIGHT / DEMO' : 'TWILIGHT / THIS WEEK'}</Text>
      <Spacer modifiers={[height(8)]} />
      <Text color={text} style={{ fontSize: 30, fontWeight: 'bold' }} maxLines={1}>{props.weeklyAverage}</Text>
      <Text color={secondary} style={{ fontSize: 12 }} maxLines={1}>{`Nightly average / ${props.weeklyDetail}`}</Text>
      <Text color={secondary} style={{ fontSize: 11 }} maxLines={1}>{props.weeklyRange}</Text>
      <Spacer modifiers={[height(12)]} />
      <Text color={text} style={{ fontSize: 16, fontWeight: 'medium' }} maxLines={1}>{`${props.latestDuration} / latest sleep`}</Text>
      <Text color={secondary} style={{ fontSize: 12 }} maxLines={1}>{props.latestLabel}</Text>
      <Spacer modifiers={[height(8)]} />
      <Text color={accent} style={{ fontSize: 12 }} maxLines={1}>{`Goal ${props.goal} / ${props.target}`}</Text>
    </Column>
  );
};

export default createWidget('TwilightSleepOverview', SleepOverview, {
  status: '', statusDetail: '', goal: 'Set in app', target: 'Your sleep schedule', latestLabel: 'Open Twilight to load your sleep data',
  latestDuration: 'No sleep yet', weeklyAverage: 'No sleep yet', weeklyDetail: 'No nights loaded', weeklyRange: '', demo: false, themeMode: 'System', colorPalette: 'Twilight',
});
