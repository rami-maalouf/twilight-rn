// the public plugin unconditionally adds an ios extension when an ios id exists.
// use its android implementation to keep this feature android-only.
module.exports = function withTwilightAndroidWidgets(config, options) {
  const withAndroidWidgets = require('expo-widgets/plugin/build/android/withAndroidWidgets').default;
  return withAndroidWidgets(config, options);
};
