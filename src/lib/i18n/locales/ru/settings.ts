export default {
  title: 'Настройки',

  // Flash messages
  savedPath: 'Путь сохранён',
  savedTimeouts: 'Таймауты сохранены',
  autostartOn: 'Автозапуск включён',
  autostartOff: 'Автозапуск выключен',
  saved: 'Сохранено',

  // View
  view: 'Вид',
  density: 'Плотность',
  densityComfortable: 'Просторно',
  densityCompact: 'Компактно',
  fullWidth: 'Контент на всю ширину',
  fullWidthDesc: 'Не ограничивать ширину 1600px (для широких экранов)',
  termScrollback: 'История терминала',
  termScrollbackDesc: 'Сколько строк вывода хранит каждая панель сессий (1000–50000)',
  termScrollbackTip: 'Применяется к новым панелям; больше строк — больше памяти',
  // Theme
  theme: 'Тема',
  themeDesc: 'Оформление интерфейса',
  themeDark: 'Тёмная',
  themeLight: 'Светлая',
  themeDarkTip: 'Тёмная тема',
  themeLightTip: 'Светлая тема',
  themeSystem: 'Система',
  themeSystemTip: 'Следовать теме ОС',
  resetView: 'Сбросить вид',
  resetViewTip: 'Вернуть плотность и ширину к значениям по умолчанию',

  // Language
  language: 'Язык',
  languageDesc: 'Язык интерфейса',
  languageTip: 'Переключить язык интерфейса — применяется сразу, без перезапуска',

  // Scripts root
  scriptsRoot: 'Путь к скриптам (SCRIPTS_ROOT)',
  scriptsRootDesc:
    'Где лежат скрипты обслуживания. Пусто = по умолчанию E:\\Scripts (или переменная окружения SCRIPTS_ROOT).',
  scriptsRootInputTip: 'Абсолютный путь к корню скриптов',
  savePathTip: 'Сохранить путь',
  currentlyUsed: 'Сейчас используется: {path}',

  // Launch
  launch: 'Запуск',
  startWithWindows: 'Запускать при входе в Windows',
  startWithWindowsDesc: 'Реестр HKCU\\…\\Run; указывает на этот exe',
  startWithWindowsTip: 'Автозапуск с Windows',
  startHidden: 'Стартовать свёрнутым в трей',
  startHiddenDesc: 'Окно не показывается при запуске, висит в трее',
  startHiddenTip: 'Старт в трее',
  closeToTray: 'Закрывать в трей',
  closeToTrayDesc: 'Кнопка ✕ сворачивает окно в трей. Выключи — ✕ будет полностью закрывать приложение.',
  closeToTrayTip: 'Поведение кнопки закрытия окна',

  // Timeouts
  timeouts: 'Таймауты (форки)',
  timeoutsDesc: 'Для медленных сетей. Пусто = значения по умолчанию скрипта.',
  fetchTimeout: 'git fetch, сек',
  fetchTimeoutTip: 'Таймаут git fetch',
  ghTimeout: 'gh запросы, сек',
  ghTimeoutTip: 'Таймаут запросов gh',
  saveTimeoutsTip: 'Сохранить таймауты',

  // About
  about: 'О программе',
  version: 'Версия',
  scripts: 'Скрипты',
  config: 'Конфиг',
  app: 'Приложение',
  openScriptsFolder: 'Открыть папку скриптов',
  openScriptsFolderTip: 'Открыть папку скриптов в Проводнике'
};
