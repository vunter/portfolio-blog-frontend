// Karma configuration file (Q12.2)
// Coverage thresholds enforce minimum test quality in CI.
//
// The Angular CLI moved its Karma integration from
// `@angular-devkit/build-angular/plugins/karma` to the modern
// `@angular/build:karma` builder declared in angular.json. The builder
// injects its own framework + plugin, so this file only declares jasmine
// and the launcher / reporter plugins.
module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-coverage'),
      require('karma-jasmine-html-reporter'),
    ],
    client: {
      jasmine: {},
      clearContext: false,
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' },
        { type: 'lcovonly' },
      ],
      check: {
        global: {
          statements: 40,
          branches: 30,
          functions: 35,
          lines: 40,
        },
      },
    },
    reporters: ['progress', 'kjhtml'],
    browsers: ['ChromeHeadless'],
    restartOnFileChange: true,
  });
};
