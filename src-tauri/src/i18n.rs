//! Backend-side localization for user-facing strings the Rust layer produces:
//! command errors (shown as toasts), the run-log stream (console panel), and the
//! tray menu (a native surface the JS i18n tables can't reach).
//!
//! The frontend owns the locale (localStorage `cmh-language`); it mirrors the choice
//! into HubConfig.language via the `set_language` command, and lib.rs keeps the current
//! `Lang` in a process global that `tr`/`trv` read.
//!
//! Parity is STRUCTURAL: every entry is `[ru, en, zh]`, so a key cannot exist for one
//! language and not another (the array type forbids it). New strings: add one row.

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Lang {
    Ru,
    En,
    Zh,
}

impl Lang {
    /// Map a frontend locale code to a Lang (unknown → Ru, the project's source language).
    pub fn parse(s: &str) -> Lang {
        match s {
            "en" => Lang::En,
            "zh" => Lang::Zh,
            _ => Lang::Ru,
        }
    }
    fn idx(self) -> usize {
        match self {
            Lang::Ru => 0,
            Lang::En => 1,
            Lang::Zh => 2,
        }
    }
}

// [ru, en, zh]. ru = the original hardcoded literal. Keep namespaces: tray.*, err.*, log.*, det.*.
#[rustfmt::skip]
const TABLE: &[(&str, [&str; 3])] = &[
    // ── tray ────────────────────────────────────────────────────────────────
    ("tray.show",      ["Показать окно", "Show window", "显示窗口"]),
    ("tray.check_all", ["Проверить всё", "Check all", "全部检查"]),
    ("tray.quit",      ["Выход", "Quit", "退出"]),
    ("tray.tooltip_sessions", ["Castellyn — активных сессий: {n}", "Castellyn — active sessions: {n}", "Castellyn — 活动会话: {n}"]),

    // ── config write (touched by language-preserving write_config) ───────────
    ("err.no_appdata",    ["APPDATA не найден", "APPDATA not found", "未找到 APPDATA"]),
    ("err.write_config",  ["запись config: {e}", "writing config: {e}", "写入 config: {e}"]),

    // ── command errors (surface as toasts) ───────────────────────────────────
    ("err.run_in_progress", ["Уже идёт другой прогон — дождись завершения или отмени.", "Another run is in progress — wait for it to finish or cancel.", "已有任务在运行 — 请等待其完成或取消。"]),
    ("err.spawn_failed", ["не удалось запустить {program}: {e}", "failed to launch {program}: {e}", "无法启动 {program}: {e}"]),
    ("err.unknown_component", ["неизвестный компонент {id}", "unknown component {id}", "未知组件 {id}"]),
    ("err.component_no_apply", ["компонент {name} не поддерживает применение", "component {name} does not support apply", "组件 {name} 不支持应用"]),
    ("err.forks_missing", ["компонент forks не найден в манифесте", "forks component not found in the manifest", "清单中未找到 forks 组件"]),
    ("err.unknown_forks_action", ["неизвестное действие forks: {action}", "unknown forks action: {action}", "未知的 forks 操作: {action}"]),
    ("err.repo_dir_missing", ["каталог репозитория не найден: {path}", "repository directory not found: {path}", "未找到仓库目录: {path}"]),
    ("err.fork_busy", ["этот форк уже обновляется", "this fork is already updating", "该 fork 正在更新中"]),
    ("err.pwsh_failed", ["не удалось запустить pwsh: {e}", "failed to launch pwsh: {e}", "无法启动 pwsh: {e}"]),
    ("err.unknown_backup_action", ["неизвестное действие backup: {action}", "unknown backup action: {action}", "未知的 backup 操作: {action}"]),
    ("err.unknown_profile", ["неизвестный профиль: {name}", "unknown profile: {name}", "未知配置: {name}"]),
    ("err.unknown_profiles_action", ["неизвестное действие profiles: {action}", "unknown profiles action: {action}", "未知的 profiles 操作: {action}"]),
    ("err.unknown_configdrift_action", ["неизвестное действие config-drift: {action}", "unknown config-drift action: {action}", "未知的 config-drift 操作: {action}"]),
    ("err.invalid_profile_name", ["недопустимое имя профиля: {name}", "invalid profile name: {name}", "配置名称无效: {name}"]),
    ("err.invalid_profile_name_plain", ["недопустимое имя профиля", "invalid profile name", "配置名称无效"]),
    ("err.invalid_new_name", ["недопустимое новое имя: {nn}", "invalid new name: {nn}", "新名称无效: {nn}"]),
    ("err.no_color", ["не указан цвет", "no color specified", "未指定颜色"]),
    ("err.unknown_profile_action", ["неизвестное действие профиля: {action}", "unknown profile action: {action}", "未知的配置操作: {action}"]),
    ("err.elevation_cancelled", ["Повышение прав отменено.", "Elevation cancelled.", "已取消提权。"]),
    ("err.unknown_sync_action", ["неизвестное действие sync: {action}", "unknown sync action: {action}", "未知的 sync 操作: {action}"]),
    ("err.invalid_service_id", ["недопустимый id сервиса: {id}", "invalid service id: {id}", "服务 id 无效: {id}"]),
    ("err.unknown_stack_action", ["неизвестное действие стека: {action}", "unknown stack action: {action}", "未知的 stack 操作: {action}"]),
    ("err.engines_no_array", ["engines.json: нет массива engines", "engines.json: no engines array", "engines.json: 缺少 engines 数组"]),
    ("err.engine_not_found", ["движок '{id}' не найден", "engine '{id}' not found", "未找到引擎 '{id}'"]),
    ("err.engine_not_found_json", ["движок '{id}' не найден в engines.json", "engine '{id}' not found in engines.json", "engines.json 中未找到引擎 '{id}'"]),
    ("err.unknown_engine_action", ["неизвестное действие engine: {action}", "unknown engine action: {action}", "未知的 engine 操作: {action}"]),
    ("err.launch_file_missing", ["файл запуска не найден: {cmd}", "launch file not found: {cmd}", "未找到启动文件: {cmd}"]),
    ("err.unknown_router_action", ["неизвестное действие router: {action}", "unknown router action: {action}", "未知的 router 操作: {action}"]),
    ("err.configure_needs_backend_model", ["для configure нужны backend и model", "configure requires backend and model", "configure 需要 backend 和 model"]),
    ("err.needs_backend_model", ["нужны backend и model", "backend and model are required", "需要 backend 和 model"]),
    ("err.invalid_profile", ["недопустимый профиль: {profile}", "invalid profile: {profile}", "配置无效: {profile}"]),
    ("err.unknown_provider_action", ["неизвестное действие provider: {action}", "unknown provider action: {action}", "未知的 provider 操作: {action}"]),
    ("err.set_needs_baseurl", ["для set нужен baseUrl", "set requires baseUrl", "set 需要 baseUrl"]),
    ("err.url_scheme", ["URL должен начинаться с http:// или https://", "URL must start with http:// or https://", "URL 必须以 http:// 或 https:// 开头"]),
    ("err.empty_host", ["пустой хост в URL", "empty host in URL", "URL 中主机为空"]),
    ("err.blocked_host", ["адрес заблокирован (SSRF/cloud-metadata): {host}", "address blocked (SSRF/cloud-metadata): {host}", "地址被阻止 (SSRF/cloud-metadata): {host}"]),
    ("err.invalid_provider_name", ["недопустимое имя провайдера (1–64 символа, без управляющих)", "invalid provider name (1–64 chars, no control characters)", "提供商名称无效 (1–64 个字符，无控制字符)"]),
    ("err.invalid_protocol", ["protocol должен быть anthropic или openai", "protocol must be anthropic or openai", "protocol 必须为 anthropic 或 openai"]),
    ("err.invalid_connectvia", ["connectVia должен быть freellmapi или direct", "connectVia must be freellmapi or direct", "connectVia 必须为 freellmapi 或 direct"]),
    ("err.empty_key", ["пустой ключ", "empty key", "密钥为空"]),
    ("err.provider_not_found", ["провайдер не найден", "provider not found", "未找到提供商"]),
    ("err.key_not_found", ["ключ не найден", "key not found", "未找到密钥"]),
    ("err.freellmapi_creds_needed", ["укажите email+пароль или токен дашборда freellmapi", "provide an email+password or a freellmapi dashboard token", "请提供 email+密码或 freellmapi 仪表板令牌"]),
    ("err.provider_no_apikey", ["для этого провайдера не задан API-ключ", "no API key is set for this provider", "该提供商未设置 API 密钥"]),
    ("err.direct_needs_profile", ["для прямого подключения укажите корректный целевой профиль", "direct connection needs a valid target profile", "直连需要有效的目标配置"]),
    ("err.freellmapi_login_first", ["сначала задайте вход в freellmapi (email+пароль или токен) — кнопка «Вход freellmapi»", "sign in to freellmapi first (email+password or token) — the “freellmapi login” button", "请先登录 freellmapi (email+密码或令牌) — “freellmapi 登录”按钮"]),
    ("err.no_gateway", ["не найден gateway в stack.json", "gateway not found in stack.json", "stack.json 中未找到 gateway"]),
    ("err.unknown_connectvia_protocol", ["неизвестная комбинация connectVia/protocol: {via}/{protocol}", "unknown connectVia/protocol combination: {via}/{protocol}", "未知的 connectVia/protocol 组合: {via}/{protocol}"]),
    ("err.single_key", ["у провайдера только один ключ — добавьте ещё для ротации", "the provider has only one key — add another to rotate", "该提供商只有一个密钥 — 请再添加一个以轮换"]),
    ("err.unknown_opencode_action", ["неизвестное действие opencode: {action}", "unknown opencode action: {action}", "未知的 opencode 操作: {action}"]),
    ("err.invalid_provider_id", ["недопустимый provider id: {id}", "invalid provider id: {id}", "provider id 无效: {id}"]),
    ("err.set_needs_base_url", ["для set нужен base_url", "set requires base_url", "set 需要 base_url"]),
    ("err.unknown_schedule_action", ["неизвестное действие schedule: {action}", "unknown schedule action: {action}", "未知的 schedule 操作: {action}"]),
    ("err.unknown_mcp_action", ["неизвестное действие mcp: {action}", "unknown mcp action: {action}", "未知的 mcp 操作: {action}"]),
    ("err.claude_launch", ["запуск claude: {e}", "launching claude: {e}", "启动 claude: {e}"]),
    ("err.invalid_plugin_id", ["недопустимый id плагина: {id}", "invalid plugin id: {id}", "插件 id 无效: {id}"]),
    ("err.unknown_plugin_action", ["неизвестное действие plugin: {action}", "unknown plugin action: {action}", "未知的 plugin 操作: {action}"]),
    ("err.bad_path", ["неверный путь", "invalid path", "路径无效"]),
    ("err.skills_dir", ["папка скиллов: {e}", "skills folder: {e}", "技能文件夹: {e}"]),
    ("err.skill_not_found", ["скилл не найден: {e}", "skill not found: {e}", "未找到技能: {e}"]),
    ("err.skill_not_in_skills", ["скилл не в ~/.claude/skills (скиллы из плагинов удаляются вместе с плагином)", "skill is not in ~/.claude/skills (plugin skills are removed with their plugin)", "技能不在 ~/.claude/skills 中 (插件技能随插件一起删除)"]),
    ("err.remove_link", ["удаление ссылки: {e}", "removing link: {e}", "删除链接: {e}"]),
    ("err.remove", ["удаление: {e}", "removing: {e}", "删除: {e}"]),
    ("err.write", ["запись: {e}", "writing: {e}", "写入: {e}"]),
    ("err.read", ["чтение: {e}", "reading: {e}", "读取: {e}"]),
    ("err.bad_config_file", ["неверный файл настроек: {e}", "invalid settings file: {e}", "设置文件无效: {e}"]),
    ("err.unknown_mode", ["неизвестный режим: {mode}", "unknown mode: {mode}", "未知模式: {mode}"]),
    ("err.measure_timeout", ["измерение превысило 180с — модель не ответила", "measurement exceeded 180s — the model did not respond", "测量超过 180 秒 — 模型未响应"]),
    ("err.claude_failed", ["claude не запустился: {e}", "claude failed to start: {e}", "claude 启动失败: {e}"]),
    ("err.parse_claude", ["не удалось разобрать ответ claude: {e}", "failed to parse claude response: {e}", "无法解析 claude 响应: {e}"]),
    ("err.no_usage_tokens", ["в ответе нет usage.input_tokens", "no usage.input_tokens in the response", "响应中没有 usage.input_tokens"]),
    ("err.unsupported_launch_mode", ["неподдерживаемый режим запуска: {mode}", "unsupported launch mode: {mode}", "不支持的启动模式: {mode}"]),
    ("err.open_terminal", ["не удалось открыть терминал: {e}", "failed to open terminal: {e}", "无法打开终端: {e}"]),
    ("err.dir_not_found", ["каталог не найден: {path}", "directory not found: {path}", "未找到目录: {path}"]),
    ("err.open_path", ["не удалось открыть {path}: {e}", "failed to open {path}: {e}", "无法打开 {path}: {e}"]),
    ("err.no_active_run", ["Нет активного прогона", "No active run", "没有正在进行的任务"]),
    ("err.bad_hotkey", ["неверная комбинация: {e}", "invalid shortcut: {e}", "快捷键无效: {e}"]),
    ("err.unknown_tool", ["неизвестный инструмент: {tool}", "unknown tool: {tool}", "未知工具: {tool}"]),
    ("err.session_not_found", ["сессия не найдена", "session not found", "未找到会话"]),
];

/// Translate a key to `lang`. Unknown key → the key itself (visible-but-stable, like the JS t()).
pub fn tr(key: &str, lang: Lang) -> &'static str {
    for (k, vals) in TABLE {
        if *k == key {
            let v = vals[lang.idx()];
            return if v.is_empty() { vals[Lang::En.idx()] } else { v };
        }
    }
    // Leak nothing: return a 'static fallback. The key isn't 'static here, so callers that
    // need the key echoed use trv (owned String). For tr, an unknown key is a bug — surface it.
    "?"
}

/// Translate with `{name}` interpolation, mirroring the frontend interpolate(). Returns an owned
/// String. Values are any Display (so call sites pass `&id`, `&e`, `&n` without `.to_string()`).
/// Unknown key → echoes the key so the miss is visible in the UI/log.
pub fn trv(key: &str, lang: Lang, vars: &[(&str, &dyn std::fmt::Display)]) -> String {
    let mut found = None;
    for (k, vals) in TABLE {
        if *k == key {
            let v = vals[lang.idx()];
            found = Some(if v.is_empty() { vals[Lang::En.idx()] } else { v });
            break;
        }
    }
    let mut s = match found {
        Some(t) => t.to_string(),
        None => key.to_string(),
    };
    for (k, v) in vars {
        s = s.replace(&format!("{{{k}}}"), &v.to_string());
    }
    s
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn picks_language() {
        assert_eq!(tr("tray.quit", Lang::Ru), "Выход");
        assert_eq!(tr("tray.quit", Lang::En), "Quit");
        assert_eq!(tr("tray.quit", Lang::Zh), "退出");
    }

    #[test]
    fn trv_interpolates() {
        assert_eq!(
            trv("tray.tooltip_sessions", Lang::En, &[("n", &3)]),
            "Castellyn — active sessions: 3"
        );
    }

    #[test]
    fn unknown_key_echoes_in_trv() {
        assert_eq!(trv("err.nope", Lang::En, &[]), "err.nope");
    }

    #[test]
    fn parse_maps_codes() {
        assert!(matches!(Lang::parse("en"), Lang::En));
        assert!(matches!(Lang::parse("zh"), Lang::Zh));
        assert!(matches!(Lang::parse("ru"), Lang::Ru));
        assert!(matches!(Lang::parse("xx"), Lang::Ru)); // unknown → source language
    }
}
