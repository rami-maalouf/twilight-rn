const { withAndroidManifest } = require('expo/config-plugins');
module.exports = function withHealthConnect(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    manifest['uses-permission'] ??= [];
    for (const permission of ['READ_SLEEP', 'WRITE_SLEEP']) {
      const name = `android.permission.health.${permission}`;
      if (!manifest['uses-permission'].some(p => p.$['android:name'] === name)) manifest['uses-permission'].push({ $: { 'android:name': name } });
    }
    return config;
  });
};
