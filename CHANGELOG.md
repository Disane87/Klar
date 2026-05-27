# [1.28.0](https://github.com/Disane87/Klar/compare/v1.27.0...v1.28.0) (2026-05-27)


### Features

* **fints:** sync interval UI + FINTS_SYNC_EVENT producer hook ([a8dcf81](https://github.com/Disane87/Klar/commit/a8dcf81cfae99061085ed2b7228f97ee3688f463))
* **notifications:** advanced JSON mode for AND/OR/NOT predicates ([a8fd501](https://github.com/Disane87/Klar/commit/a8fd501ee9de778e363d3c94dd1f5c4e30a7a04e))

# [1.27.0](https://github.com/Disane87/Klar/compare/v1.26.0...v1.27.0) (2026-05-27)


### Bug Fixes

* **notifications:** SSRF allowlist on push endpoint + faster bell refresh ([96b78dd](https://github.com/Disane87/Klar/commit/96b78ddefffc37ea8b661ccb44d053380df8efd6))


### Features

* **fints:** per-connection sync interval (Phase 8) ([559be7d](https://github.com/Disane87/Klar/commit/559be7d992acea57c13b081e426c4cc63e8a0f72))
* **notifications:** email channel + digest queue (Phase 4) ([ad62560](https://github.com/Disane87/Klar/commit/ad625606b98b5b906bb3f4ed61160efc10332dec))
* **notifications:** schedule editor, live preview, activity feed (Phase 7) ([f0a14e2](https://github.com/Disane87/Klar/commit/f0a14e23109fd71929b2d117fff4020f2c1a6743))
* **notifications:** SCHEDULED trigger + aggregation providers (Phase 6) ([0a5926e](https://github.com/Disane87/Klar/commit/0a5926eed2f7a6400974081313ca9f185decb655))
* **notifications:** STANDING_ORDER_DUE, BUDGET_THRESHOLD, FINTS_SYNC_EVENT triggers (Phase 5) ([bdb0d72](https://github.com/Disane87/Klar/commit/bdb0d72a62d7fa6258505fe72997078c13360cc8))
* **notifications:** web push channel (Phase 3) ([977888b](https://github.com/Disane87/Klar/commit/977888bab1e873d404210f837fda6c90ffd9c809))

# [1.26.0](https://github.com/Disane87/Klar/compare/v1.25.0...v1.26.0) (2026-05-27)


### Bug Fixes

* **notifications:** bell popover clipped by top-bar overflow-x-auto ([0147d0c](https://github.com/Disane87/Klar/commit/0147d0c897b7c4bf3513b5eb3ee5afdd7c860d9b))
* **notifications:** bell popover crash when RouterLink injects ActivatedRoute ([2ea6896](https://github.com/Disane87/Klar/commit/2ea68969988d8153fcd9e24f6840cd520ebb348e))
* **notifications:** rule builder accepts Euro for money fields ([190d28c](https://github.com/Disane87/Klar/commit/190d28c7d32313fb430dac7ade6939caed997b3f))


### Features

* **notifications:** rules CRUD + in-app dispatcher + transaction trigger (Phase 2) ([4e5a4fd](https://github.com/Disane87/Klar/commit/4e5a4fd9f89f39823dc0fa3add81bdb84957df87))
* **notifications:** rules engine foundation (Phase 1) ([ceb9976](https://github.com/Disane87/Klar/commit/ceb9976cf4ea830ae702dc8925170242bdf7d1f9))
* **notifications:** surface rules page in Settings + bell popover ([803ce00](https://github.com/Disane87/Klar/commit/803ce0074efe5a465d40f5b5eb84af47e14996aa))

# [1.25.0](https://github.com/Disane87/Klar/compare/v1.24.0...v1.25.0) (2026-05-27)


### Bug Fixes

* **fixed-costs:** show monthly equivalent on rows, original on meta line ([a398d33](https://github.com/Disane87/Klar/commit/a398d332d66479a69103cec7b3eb182985d6fb86))
* **recurring:** derive sign from category type instead of input amount ([c662f10](https://github.com/Disane87/Klar/commit/c662f1080ee74808618d474c11f1287f866b519e))


### Features

* **accounts:** add endpoint to purge an account's transactions ([448c8f1](https://github.com/Disane87/Klar/commit/448c8f18cf5331eddf70e74dc6029370bdee59d8))

# [1.24.0](https://github.com/Disane87/Klar/compare/v1.23.0...v1.24.0) (2026-05-27)


### Bug Fixes

* **cashflow:** treat Übertrag/Umbuchung as TRANSFER and exclude from monthly cashflow ([1b0adeb](https://github.com/Disane87/Klar/commit/1b0adeb555a050d1ae3692047e87ae6bc30131e1))


### Features

* **fints:** cap TAN-resume attempts to prevent PIN/TAN lockouts ([cd9a751](https://github.com/Disane87/Klar/commit/cd9a75115e719870e9ea63957a025d517e38084e))
* **fixed-costs:** add weekly billing cycle ([9f323f8](https://github.com/Disane87/Klar/commit/9f323f847812d93e280dd879459668e08d0e7c03))
* **overview:** liquidity forecast + cashflow insights on monat page ([be8e05c](https://github.com/Disane87/Klar/commit/be8e05c605871836a35d2dc12774ae4b6ff04b3b))

# [1.23.0](https://github.com/Disane87/Klar/compare/v1.22.0...v1.23.0) (2026-05-27)


### Features

* **fints:** configurable auto-sync cron + registered product ID ([a5a5308](https://github.com/Disane87/Klar/commit/a5a5308c0492e3c6e83efc1f8a807feb099f7b7c))

# [1.22.0](https://github.com/Disane87/Klar/compare/v1.21.0...v1.22.0) (2026-05-12)


### Features

* **payroll-calc:** persist inputs, dual-period view, effective rates ([07f41fe](https://github.com/Disane87/Klar/commit/07f41fe7eddcf10e5c631772674203dfb77c56e2))

# [1.21.0](https://github.com/Disane87/Klar/compare/v1.20.5...v1.21.0) (2026-05-12)


### Bug Fixes

* **klar-select:** silence NG0951 from BrnSelectContent scroll buttons ([05c71b3](https://github.com/Disane87/Klar/commit/05c71b331bec7ba7ba308ba0cbd97e552b2a290b))
* **payroll:** verified 2026 KK Zusatzbeiträge + double-click on klar-button ([619f534](https://github.com/Disane87/Klar/commit/619f53475198e0d8052480fc309a1b055b99c88c))


### Features

* **brutto-netto:** transfer position splits 1:1 to Fixkosten ([d3ab29e](https://github.com/Disane87/Klar/commit/d3ab29e12ae7ccfa8e2bf48a72fb5a3d6fa8af5f))
* **fints:** accept optional fromDate/toDate on manual sync endpoint ([9c82bce](https://github.com/Disane87/Klar/commit/9c82bcecfaa607691c99dfdc05098881d0dad310))
* **fints:** add 'range' wizard step for initial-sync date picker ([62e0045](https://github.com/Disane87/Klar/commit/62e0045bee024f0aaad497e1a2f055e9f89eb48a))
* **fints:** cache bank-advertised statement capabilities per connection ([4f00ac8](https://github.com/Disane87/Klar/commit/4f00ac85387949f89b126ddf561c30cbad69e883))
* **payroll:** add German gross-to-net calculator ([2beb560](https://github.com/Disane87/Klar/commit/2beb56087302613b2f8114792a7043e6bec2399b))
* **payroll:** multiple gross positions, KK select, transfer to Fixkosten ([7eca8dd](https://github.com/Disane87/Klar/commit/7eca8dd99346f8c18b65ac1529d139b70366e22f))
* **transactions:** bulk-set visibility + flip default to PRIVATE ([d294543](https://github.com/Disane87/Klar/commit/d294543c3216bd4526963405193223b44e3d3b7b))
* **web:** multi-select transactions with bulk visibility toggle ([df9ead3](https://github.com/Disane87/Klar/commit/df9ead3f3070d8e33e3a74ff467dc9908c4c0bcc))

## [1.20.5](https://github.com/Disane87/Klar/compare/v1.20.4...v1.20.5) (2026-05-11)


### Bug Fixes

* **import-pipeline:** dedup repeated bankTxId within a single batch ([1f7cf39](https://github.com/Disane87/Klar/commit/1f7cf39927d54121e6731711ee3f2c7ad243eccd))

## [1.20.4](https://github.com/Disane87/Klar/compare/v1.20.3...v1.20.4) (2026-05-11)


### Bug Fixes

* **fints:** clamp product version to ZKA AN..5 length ([94aff8c](https://github.com/Disane87/Klar/commit/94aff8cf76656ab4a0ef40ad6ececef6ba3b15d5))

## [1.20.3](https://github.com/Disane87/Klar/compare/v1.20.2...v1.20.3) (2026-05-11)


### Bug Fixes

* **fints:** use APP_VERSION as ZKA product version ([14da521](https://github.com/Disane87/Klar/commit/14da52178a9917505661259b31e6b2d461eaf5ec))

## [1.20.2](https://github.com/Disane87/Klar/compare/v1.20.1...v1.20.2) (2026-05-11)


### Bug Fixes

* **api:** load lib-fints by reading package.json from disk ([decef8a](https://github.com/Disane87/Klar/commit/decef8a6c800332cc08e6086a999418aa7150377))

## [1.20.1](https://github.com/Disane87/Klar/compare/v1.20.0...v1.20.1) (2026-05-11)


### Bug Fixes

* **api:** resolve lib-fints via createRequire so ESM import works in prod ([ec8ee93](https://github.com/Disane87/Klar/commit/ec8ee93a923bb08031664ba38ebda5990927f0c9))

# [1.20.0](https://github.com/Disane87/Klar/compare/v1.19.2...v1.20.0) (2026-05-11)


### Features

* **api:** log version and environment on startup ([2695efd](https://github.com/Disane87/Klar/commit/2695efd6098af6c9c52637738926bb4e0ecf5599))

## [1.19.2](https://github.com/Disane87/Klar/compare/v1.19.1...v1.19.2) (2026-05-11)


### Bug Fixes

* **api:** resolve root package.json by walking upward at runtime ([ee5a721](https://github.com/Disane87/Klar/commit/ee5a7216a92bf68f3157ea0a51c2c97af96fedd9))

## [1.19.1](https://github.com/Disane87/Klar/compare/v1.19.0...v1.19.1) (2026-05-11)


### Bug Fixes

* **web:** use dynamic version in side-nav brand label ([5e0b77f](https://github.com/Disane87/Klar/commit/5e0b77f0c041e27c6af698af800142443897b8dc))

# [1.19.0](https://github.com/Disane87/Klar/compare/v1.18.1...v1.19.0) (2026-05-11)


### Features

* update application version to 1.18.0 and integrate VersionService for dynamic versioning ([f19551f](https://github.com/Disane87/Klar/commit/f19551ffc8995edaa13a37853e0320e4c3245633))

## [1.18.1](https://github.com/Disane87/Klar/compare/v1.18.0...v1.18.1) (2026-05-11)


### Bug Fixes

* **layout:** mobile header no longer bleeds into iOS notch on scroll ([b6f89c4](https://github.com/Disane87/Klar/commit/b6f89c4886b5a1a5da47f9a1a339686c4a6674b5))

# [1.18.0](https://github.com/Disane87/Klar/compare/v1.17.0...v1.18.0) (2026-05-11)


### Features

* **accounts:** add repository.update with householdId scoping ([0f870b5](https://github.com/Disane87/Klar/commit/0f870b58b61119017a3e67f417f5f40ea537d67b))
* **accounts:** expose GET /accounts and PATCH /accounts/:id ([3b98ed9](https://github.com/Disane87/Klar/commit/3b98ed9376d3f89167825bc5bcc50803ec312e79))
* **accounts:** service.update with FinTS owner-only guard ([788136f](https://github.com/Disane87/Klar/commit/788136f34474e456470ec9e7888ed126f9003d24))
* OpenAPI doc ([787cd4b](https://github.com/Disane87/Klar/commit/787cd4b0120ce8985155a6b4ecc5bb102d481c95))

# [1.17.0](https://github.com/Disane87/Klar/compare/v1.16.0...v1.17.0) (2026-05-08)


### Bug Fixes

* **api:** import HouseholdsModule into StandingOrdersModule for HouseholdMemberGuard ([43f6535](https://github.com/Disane87/Klar/commit/43f6535787ff1c82997f2b2d1c99cf58022b8cb9))
* **auth:** register SessionsController in AuthModule ([a1aa9ad](https://github.com/Disane87/Klar/commit/a1aa9adcc7d15c5720f520c71079e1a84854c33e))
* **buchungen:** a11y preventDefault on keydown.space + spec hygiene ([40af13b](https://github.com/Disane87/Klar/commit/40af13b1bec5abc8d0caca387ad2509f6a4ab58d))
* **buchungen:** drop dead formatDate + add keydown.space activation ([5a1eb8e](https://github.com/Disane87/Klar/commit/5a1eb8e2c0819b9d245010098dac1ce4face1802))
* **fints:** cache FinTSClient across TAN flow + pushTAN spinner UX ([9e2a862](https://github.com/Disane87/Klar/commit/9e2a862bdecf2f3c1e747070bce4133784bdca3e))
* **fints:** hard-fail when bank confirms TAN but returns no UPD + extend orphan cleanup ([eb3fa4e](https://github.com/Disane87/Klar/commit/eb3fa4e59c5e791fe7a866e5b23a8413812b31fe))
* **fints:** orphan cleanup + 9078 product-id hint + alert callouts ([097102b](https://github.com/Disane87/Klar/commit/097102beb68c7f7d97bcbabc1a046fab4439b7d9))
* **fints:** surface real bank errors instead of silent empty accounts ([d47fd22](https://github.com/Disane87/Klar/commit/d47fd2271b909f840135a6e42ea4a15edb1c224a))
* **fints:** two-pass synchronize protocol + dupe-creation guards ([110fbcc](https://github.com/Disane87/Klar/commit/110fbccfcc1ba118ca858e434745c97254ca63a5))
* **fixkosten:** align right rail + page header with bundle PageFixkosten ([fa8a631](https://github.com/Disane87/Klar/commit/fa8a6310e9f5b309bad55496ac85c47a3ca35390))
* **klar-list-item:** chevron lands inside .setting-rhs (no row break) ([278fd43](https://github.com/Disane87/Klar/commit/278fd43c7625efbc7800c3a5ef86852673d8d340))
* **layout:** allow document scroll on mobile (html/body overflow gating) ([33955e2](https://github.com/Disane87/Klar/commit/33955e2dd5a8186216412761f7423cfb7359e416))
* **layout:** klar-async-state lets document scroll on mobile ([58d41fb](https://github.com/Disane87/Klar/commit/58d41fbe316129d10665446f1166330ac92b46da))
* **layout:** mobile uses document scroll + hide klar-hero on mobile globally ([371a6df](https://github.com/Disane87/Klar/commit/371a6dfa2fa6a560f934e8d9e9a0dba1ba19cf94))
* **side-nav:** drop /app/spec + /app/crud nav entries ([342ea36](https://github.com/Disane87/Klar/commit/342ea36bb82df90dcdace990d3d25dd7432dacd7))
* **transactions:** allow document scroll on mobile (Buchungen + Bankkonto) ([17c044e](https://github.com/Disane87/Klar/commit/17c044e271bdfac52cd608e7256e5a072710eb34))
* **ui:** add host class for klar-async-state component ([f7603de](https://github.com/Disane87/Klar/commit/f7603de2fc7f5aa5cf1140b67f1e8a3dd8e20233))
* **web:** add 2px amber active-indicator to mobile bottom-nav ([6566252](https://github.com/Disane87/Klar/commit/656625291191c5d888658ae2adcd68f87d70e08b))
* **web:** add CUSTOM_ELEMENTS_SCHEMA for iconify-icon + drop unused KlarButton import ([6c699ce](https://github.com/Disane87/Klar/commit/6c699cea5d4b036ac52961775a36a62bea677b5b))
* **web:** align dialog backdrop + entry keyframes with bundle ([650c653](https://github.com/Disane87/Klar/commit/650c653058a2ebf6bd8434133d7bdc0d74d0622b))
* **web:** align page-header blur + stage radial-gradients with bundle ([d8c27f2](https://github.com/Disane87/Klar/commit/d8c27f2022e0831f3e339fa09f9ddbea7a9ce5e9))
* **web:** guard projects() resource access in projekte template ([e16e4dc](https://github.com/Disane87/Klar/commit/e16e4dc9fe262327c47eff614077ff60b63b3569))
* **web:** replace native form controls with hlm wrappers ([8e08e30](https://github.com/Disane87/Klar/commit/8e08e3051c06c1b419272a283b3fd265413c750d))
* **web:** tighten summary-strip layout for mobile ([3431caa](https://github.com/Disane87/Klar/commit/3431caa2d3b8253413504bf6489c47139986944e))
* **web:** unify input control height + background across forms ([7ef6d44](https://github.com/Disane87/Klar/commit/7ef6d44462d3a0d504ca151278b53d2ff4e55da6))
* **web:** unmix ?? and || in extractErrorMessage (Angular build) ([a2de868](https://github.com/Disane87/Klar/commit/a2de868829c337a6accf86d8eac08a16acbb3a6c))
* **web:** widen create/edit dialogs from sm to md ([6c50bbd](https://github.com/Disane87/Klar/commit/6c50bbd630a3b22b4948572d0272bcf4b982bf6d))


### Features

* **admin:** /admin/health/* + /admin/jobs telemetry endpoints ([8fd21f9](https://github.com/Disane87/Klar/commit/8fd21f9c323d3cd591c78962d0df937a620631a4))
* **admin:** align admin hero with bundle PageAdmin admin-hero card ([e19b181](https://github.com/Disane87/Klar/commit/e19b1812464c3a02c2f9595b32d449ab339870b5))
* **admin:** apply Klar Design Pearl visual treatment ([2467df0](https://github.com/Disane87/Klar/commit/2467df06e7c1b1d65b6b1a1b1098cf31449335a4))
* **admin:** bundle PageAdmin status/services/perf/jobs cards ([df0969f](https://github.com/Disane87/Klar/commit/df0969fc5e01204b0d1f0b77817998b75764738b))
* **admin:** port admin page 1:1 to design-pearl bundle layout ([376882c](https://github.com/Disane87/Klar/commit/376882c575dd75dc8ea46ec507bf12054fcf8d5c))
* **api,web:** bank-field lockout on FinTS-imported transactions (14a.8) ([388c816](https://github.com/Disane87/Klar/commit/388c8169ede3f85118aa54cef1752476aea152b9))
* **api:** admin health metrics collector + live-log buffer ([9025f39](https://github.com/Disane87/Klar/commit/9025f3915db55e98c76e9806815457c8ecdf0a4a))
* **api:** BLZ registry with hbci4j fetcher and resilient cache (14a.4) ([bc32fdb](https://github.com/Disane87/Klar/commit/bc32fdb27a1ac77c8d4bf57c5ddc243bedd09c4e))
* **api:** bulk-move/bulk-delete transactions + bulk-pause recurring ([7ca7a50](https://github.com/Disane87/Klar/commit/7ca7a509a406f458b1b39ab07bda4b613825804f))
* **api:** FinTS module skeleton with AES-256-GCM crypto (14a.3) ([18d9435](https://github.com/Disane87/Klar/commit/18d9435186540bde48d0e44c45ad755302a5b804))
* **api:** FinTS reauth watcher + BLZ refresh scheduler (14a.7-partial) ([401aad1](https://github.com/Disane87/Klar/commit/401aad13a638a675e1d1fb1dee6c3247384b9a9a))
* **api:** FinTS REST controller + service for setup wizard (14a.6 backend) ([2b6c048](https://github.com/Disane87/Klar/commit/2b6c0487a716a20907f3136f3fbe18f1c63785c3))
* **api:** FinTS sync runner + ImportPipeline.ingest + ESM loader (14a.7-final) ([e269eba](https://github.com/Disane87/Klar/commit/e269eba9d9332c02f638007cd02932b97f701791))
* **api:** introduce Account entity (FinTS foundation, phase 14a.1) ([1ec810d](https://github.com/Disane87/Klar/commit/1ec810d1a0b9b11957f551b34308e0f86d87be1c))
* **api:** lib-fints client wrapper + booking mapper (14a.5) ([d138592](https://github.com/Disane87/Klar/commit/d13859227e163898e5d511b6cc47d8b98192d8e1))
* **api:** map FinTS booking codes to transactionKind ([c7372c3](https://github.com/Disane87/Klar/commit/c7372c343e03d165492def338a184522abd130a3))
* **api:** plumb transactionKind through import pipeline ([99889ba](https://github.com/Disane87/Klar/commit/99889bac281b5b3f6b9ae404551cf499c49e6e1a))
* **api:** standing-order detection service (sync-time grouping) ([6e7dec0](https://github.com/Disane87/Klar/commit/6e7dec0227cf1b966debdc0c74ef02adeda79687))
* **api:** standing-orders CRUD endpoints with bank-field locking ([51ae7e3](https://github.com/Disane87/Klar/commit/51ae7e3231b29d78cd4b66787ed48fa467ca36e0))
* **api:** trigger standing-order detection at end of FinTS sync ([1d93511](https://github.com/Disane87/Klar/commit/1d9351136a19ec687051efd1fe729eef5e3b527a))
* **api:** wire notifications module — controller, tests, app wiring ([4cc9c43](https://github.com/Disane87/Klar/commit/4cc9c438d391f3d70dfec4d47726d8ead57bae9b))
* **auth:** add session metadata + /me/sessions list/revoke endpoints ([1d3591b](https://github.com/Disane87/Klar/commit/1d3591bc48f7726fdc70f88b0338e98317d711e8))
* **auth:** shared klar-auth-brand-pane component ([b92f1e3](https://github.com/Disane87/Klar/commit/b92f1e310919b9058b09d83072a586777b1b74dd))
* **auth:** wire brand-pane into all 7 auth pages ([a3119b7](https://github.com/Disane87/Klar/commit/a3119b705d24fda16667c04af0897a86be776840))
* **buchungen:** port to bundle PageMonth BookingsList card+row pattern ([3b4c814](https://github.com/Disane87/Klar/commit/3b4c814e5c118745570eae14e54ba53be9f860a0))
* **connected-apps:** per-user CRUD module ([68abe5a](https://github.com/Disane87/Klar/commit/68abe5a7bd9db269dc65a1f198eff5cde227f408))
* **contracts:** detection + CRUD module ([ec7c003](https://github.com/Disane87/Klar/commit/ec7c0032a247273a8b19ee7dcc68626b6fc9a5d7))
* **crud:** /app/crud demo with 8 dialog patterns ([725aacf](https://github.com/Disane87/Klar/commit/725aacf4815b1fa07e375b7d68dae6a9c84bc34a))
* **csv-import:** apply Klar Design Pearl visual treatment ([bfdd71f](https://github.com/Disane87/Klar/commit/bfdd71fcac3b78fdbb52dabd063eff73c0052cc2))
* **db:** add TransactionKind enum and StandingOrder model ([ec4f7db](https://github.com/Disane87/Klar/commit/ec4f7db0c3b4006afa09a85f10dbb5bae58512c5))
* **db:** backfill transactionKind on existing FinTS transactions ([1cc8bd5](https://github.com/Disane87/Klar/commit/1cc8bd5f730d840c905c1e1e3a7fe04986eeafbe))
* FinTS integration ([ec4b89e](https://github.com/Disane87/Klar/commit/ec4b89e2d482768a97803932ef4e542a2f21dfdf))
* **fixkosten:** port Klar Design Pearl layout to fixkosten page ([1fef853](https://github.com/Disane87/Klar/commit/1fef85367975ecbf8d3e530893f72562fc65a426))
* **fixkosten:** split categorized list into Einnahmen + Ausgaben sections ([18e85b7](https://github.com/Disane87/Klar/commit/18e85b7a8a4e5073a7819c5b3be71e6aebd6058d)), closes [#groupTpl](https://github.com/Disane87/Klar/issues/groupTpl)
* **fixkosten:** strict 1:1 row + card pattern from bundle PageFixkosten ([ce20048](https://github.com/Disane87/Klar/commit/ce2004895a2ee7a0a42624c8548706d30a36ae41))
* **haushalt:** align all sections to bundle setting-group + role chips ([2adb57e](https://github.com/Disane87/Klar/commit/2adb57ed243a77b8220338531782fb3e54b84682))
* **haushalt:** hero info card + page-header rhsChip ([0e71842](https://github.com/Disane87/Klar/commit/0e71842aaf8f3d45821abf19f8739cc37e46c980))
* **haushalt:** port Klar Design Pearl layout for haushalt page ([5c58b4a](https://github.com/Disane87/Klar/commit/5c58b4a520b788da60c02a3e58828323ed6f4d5f))
* **header:** add UserSwitch + Scope-Segmented primitives + page-header slots ([a9f6927](https://github.com/Disane87/Klar/commit/a9f69276fc9005bbb4e22f254fd3d5f645de5513))
* **kalender:** add bundle .cal-* CSS primitives ([00bb6d3](https://github.com/Disane87/Klar/commit/00bb6d3f27ac3fa501438f35a2a4bf7f41f94d38))
* **kalender:** port to bundle PageCalendar layout (cal-strip + cal-grid + day modal) ([6a3c68d](https://github.com/Disane87/Klar/commit/6a3c68d83ef30be3f33c77f1d5acf606994cb86e))
* **layout:** encapsulate mobile bottom-nav and header per design-pearl ([facfabb](https://github.com/Disane87/Klar/commit/facfabb6c26b1f7b08139ee2585675ad0c9cedd0))
* **layout:** household switcher dropdown + drop redundant chrome ([bfec04f](https://github.com/Disane87/Klar/commit/bfec04f5f82608b86547cb4712afcb6739670c5b))
* **monat:** align Cashflow page with bundle PageMonth ([bdc7a75](https://github.com/Disane87/Klar/commit/bdc7a75103217b18a945bad6560f038bee53c4d2))
* **monat:** Soll vs Ist budget meter card ([4474371](https://github.com/Disane87/Klar/commit/4474371eb9fcdfbba19c1a12652dfbc08f024946))
* **notiz+status:** household note model + Status-diesen-Monat counters ([32d8a76](https://github.com/Disane87/Klar/commit/32d8a76c60b4c1a7dbc62edd92b1d5c5f02c5343))
* **overview:** budgets-vs-actuals endpoint + shared calc ([d1162b3](https://github.com/Disane87/Klar/commit/d1162b346840944cc7cb7e2e988fc7f0a039c4df))
* **overview:** expose category icon in fixed-costs response ([3911d4d](https://github.com/Disane87/Klar/commit/3911d4df7123188dcaff5828df0c9276b5765fd4))
* **page-header:** add rhsChip slot for inline header chip ([5bafdbf](https://github.com/Disane87/Klar/commit/5bafdbff871c399f315ae95325b55f0d1b87f18a))
* **projekte:** drop legacy meter CSS + README update ([0125927](https://github.com/Disane87/Klar/commit/012592782185583a3d0615af38309eade67b3e3d))
* **projekte:** port project-detail to bundle hero + .card+.row pattern ([348d4ef](https://github.com/Disane87/Klar/commit/348d4efaa80659370522e1825765d3a1e325539b))
* **projekte:** swap meter bar for klar-progress-ring in tile ([e9e0a70](https://github.com/Disane87/Klar/commit/e9e0a70f19b64baab387e57eb3dde153dde99702))
* **settings:** hero profile-card + bundle SettingGroup layout + app-info strip ([725b319](https://github.com/Disane87/Klar/commit/725b319d3445ceb81f5585ed087271acacce724c))
* **shared:** add deriveFrequency helper for standing-order cadence inference ([32a41fc](https://github.com/Disane87/Klar/commit/32a41fcabaf464ab5687c0f9104f1ae38c0e43a3))
* **shared:** add detectTransactionKind helper for FinTS booking classification ([65aab6c](https://github.com/Disane87/Klar/commit/65aab6c7f6ddb9c1f17c0c6250175d49e7bff6a5))
* **spec:** /app/spec dev-gallery for design primitives ([ead3748](https://github.com/Disane87/Klar/commit/ead3748493a33bb9ea0c14a24e29fbed8ffef593))
* **splits:** RecurringTransactionSplit model + Fixkosten sub-rows ([e17f1d9](https://github.com/Disane87/Klar/commit/e17f1d95538a68be9912fe123a7819bbc94f0063))
* **splits:** TransactionSplit model + service + cascade delete ([a3efcf6](https://github.com/Disane87/Klar/commit/a3efcf67247623b4dcf5068d04d34d7f6371b5fe))
* **standing-orders:** also detect SEPA Lastschriften + add brand icon and type chip ([cbaa9a7](https://github.com/Disane87/Klar/commit/cbaa9a77fc1b44cbac6fdbcad57447da56591a16))
* **transactions:** brand icon auto-detect on transaction rows ([07b1be1](https://github.com/Disane87/Klar/commit/07b1be1f80490fbef68c043ae4483d6860259bcd))
* **transactions:** consolidate buchungen + bankkonto into shared klar-transactions-table ([1bbc43a](https://github.com/Disane87/Klar/commit/1bbc43a3a80830df26a37865ee6478d75e87e6eb))
* **transactions:** type chip on rows (Dauerauftrag/SEPA-Lastschrift/Manuell/...) ([2e97083](https://github.com/Disane87/Klar/commit/2e970831e1bb5192d39ebb538b45bca8a432be8e))
* **transactions:** unify edit dialog with recurring (color + icon) ([87721ed](https://github.com/Disane87/Klar/commit/87721edae8b225586bdb3f16cddddd3301c74924))
* **ui:** adapt klar-list-item + klar-list-group to bundle setting-row pattern ([b9d8629](https://github.com/Disane87/Klar/commit/b9d8629e208bc5bc40722993b49ccec5269f797f))
* **ui:** add klar-hero + klar-stat-tile primitives, migrate admin page ([200faf0](https://github.com/Disane87/Klar/commit/200faf06b1c7e488c03ccad57188a56a6147dc26))
* **ui:** add progress-ring, confidence-bar, hypo-chip primitives ([a7e0bf3](https://github.com/Disane87/Klar/commit/a7e0bf3e4e3e4ddface4d5bc9e0a2cd7306f8ebf))
* **ui:** compact summary cards on mobile (smaller padding+font, hide sub-line) ([51f475a](https://github.com/Disane87/Klar/commit/51f475a8177fbf6c3087b524aa4484cfb7e212f6))
* **ui:** compact summary cards on mobile across all pages ([e64bd8e](https://github.com/Disane87/Klar/commit/e64bd8ecf6498c38278908ad0f20cfc4ed61ed91))
* **web:** add brand-icon fallback inputs for category icons ([896aaae](https://github.com/Disane87/Klar/commit/896aaaeacd38fcdacd49aa51ab0feee9fdc2b74b))
* **web:** add Design Pearl button/chip/input utilities + Planspiel chip ([f3c23ba](https://github.com/Disane87/Klar/commit/f3c23baa476da5daa9f69ecc718bd84f021e3971))
* **web:** add hlm wrappers for switch, tabs, tooltip, sheet, alert-dialog, separator ([87dce30](https://github.com/Disane87/Klar/commit/87dce30de74530b7833f90bcd1ff28b4e98ec702))
* **web:** add Kalender page (month grid with transactions as dots) ([33136a2](https://github.com/Disane87/Klar/commit/33136a27bf4c30450bbe9570c8b18361b82363dc))
* **web:** add klar-dialog-callout, apply two-column grids in CRUD forms ([7db8465](https://github.com/Disane87/Klar/commit/7db8465e01a6b17cbc6acdb6275dedf5d2cfc407))
* **web:** add mode-toolbar + warm brand color refresh ([dfabeb1](https://github.com/Disane87/Klar/commit/dfabeb17f8257fdf28f158b95c0a9fea779d8639)), closes [#09090b](https://github.com/Disane87/Klar/issues/09090b) [#1c1814](https://github.com/Disane87/Klar/issues/1c1814)
* **web:** add StandingOrdersStore ([cea1aee](https://github.com/Disane87/Klar/commit/cea1aee40f63a02e49b2e489b2d33fb6bf3020f6))
* **web:** add Statistik page (KPI strip + category mix + top movers) ([70e0e49](https://github.com/Disane87/Klar/commit/70e0e49184740e60d17a7ac37685b9ff34f593dd))
* **web:** add Verträge page (auto-detected contracts) at /app/vertraege ([3e216cd](https://github.com/Disane87/Klar/commit/3e216cd8546bbcf1392df509cd8fb0f5ee946b1d))
* **web:** adopt Klar Design Pearl tokens (foundation) ([76d89a9](https://github.com/Disane87/Klar/commit/76d89a999607aec34b614667e67ed455a72763f5))
* **web:** apply Design Pearl 2px category left-border to list groups ([68ba865](https://github.com/Disane87/Klar/commit/68ba8650b6e685e252c65cb67c668f08d7f4d9b4))
* **web:** apply Klar Design Pearl sidebar (warm tinted nav with category tones) ([8a81e49](https://github.com/Disane87/Klar/commit/8a81e4982db248ccdc789b0fe5ff577d89ff0bcd))
* **web:** Banken page + FinTS setup wizard (14a.6 UI) ([acfd86e](https://github.com/Disane87/Klar/commit/acfd86e7e5cfa3b57c22a767d0ed70822ef6c5b1))
* **web:** diff chips + change summary in recurring-edit-dialog ([693488e](https://github.com/Disane87/Klar/commit/693488e35d1481ebd0a61f7604990de14338a091))
* **web:** FinTS service + store data layer (14a.6 frontend wiring) ([199d5a5](https://github.com/Disane87/Klar/commit/199d5a51c98298de7aef652c3ca50456070a1814))
* **web:** klar composites — confirm, async-state, money/date input, dialog-footer, action-tile, switch ([1610e8c](https://github.com/Disane87/Klar/commit/1610e8c2a58cec4fbc807fdfd30246af77082153))
* **web:** klar-async-state — custom loading slot via klarLoading directive ([e2aea47](https://github.com/Disane87/Klar/commit/e2aea476c468e8f7308ad49ed0406cecc2744e8d))
* **web:** klar-select replaces every native <select hlmSelect> ([25c17d5](https://github.com/Disane87/Klar/commit/25c17d57b0708927a3dafca6074586cdfa4e4a2d))
* **web:** migrate page header (desktop + mobile) to Design Pearl typography ([6fecc96](https://github.com/Disane87/Klar/commit/6fecc963b728fcb355443d1f5c00383173ea98b6))
* **web:** nav 'Daueraufträge' now points to dedicated page ([515bfac](https://github.com/Disane87/Klar/commit/515bfac7df31068f3f7b6bff7588e9abec45e43a))
* **web:** pdf export dialog matching design-pearl proposal ([fd2aa46](https://github.com/Disane87/Klar/commit/fd2aa46036a68f7bbff38fc007087bf903c7d2c1))
* **web:** standing-orders page + create/edit dialog ([dadcd97](https://github.com/Disane87/Klar/commit/dadcd979ed3427f46b040eb429f06acda41c7ac3))
* **web:** visual stepper + searchable bank combobox in setup wizard ([79ed3df](https://github.com/Disane87/Klar/commit/79ed3df12f24e00e5c709b259eb39e692731c326))
* **web:** wire bell + notification center to backend (Phase 6 + 11.1 frontend) ([7d29185](https://github.com/Disane87/Klar/commit/7d29185c9b7b6d0419e50bfb73af2d3f9a56f18c))

# [1.16.0](https://github.com/Disane87/Klar/compare/v1.15.0...v1.16.0) (2026-05-06)


### Features

* **api:** add filter indexes on audit_log ([820e4d0](https://github.com/Disane87/Klar/commit/820e4d0d5dfa940de5656a1bf72e13df61ffdc19))
* **api:** add MCP audit helpers (action prefix, args hash) ([feb348e](https://github.com/Disane87/Klar/commit/feb348e10e9959088056e0cf2294cd2d62637d64))
* **api:** audit every MCP tool call with duration, ok/fail, args hash ([5104b5d](https://github.com/Disane87/Klar/commit/5104b5de3eb29d02ab9fc5e097896a1226394625))
* **api:** audit MCP session start ([28382f4](https://github.com/Disane87/Klar/commit/28382f4eaf40d14137e266f3322ad44e0aa7868c))
* **api:** cursor pagination, /admin/mcp endpoint, resolved user/household DTOs ([73149cd](https://github.com/Disane87/Klar/commit/73149cd33c9f08d2c02be73d605b8c1816e155f8))
* **web:** admin refactor — virtual lists, search/filter per tab, MCP tab ([7c02d72](https://github.com/Disane87/Klar/commit/7c02d72271e56faae4569e0f8b18a75c1eac7942))


### Performance Improvements

* **web:** faster dev cold start ([6e3eb9d](https://github.com/Disane87/Klar/commit/6e3eb9d8ce41749af32e2bcd8a71a11d1df0b58a))

# [1.15.0](https://github.com/Disane87/Klar/compare/v1.14.0...v1.15.0) (2026-05-06)


### Features

* **ui:** enhance user avatar section and improve layout for Help & Community links ([bb5e2a8](https://github.com/Disane87/Klar/commit/bb5e2a84c910add9f2f8c6281539daf15f208923))

# [1.14.0](https://github.com/Disane87/Klar/compare/v1.13.0...v1.14.0) (2026-05-06)


### Features

* **web:** add Help & Community section with GitHub links to user menu ([41e9f64](https://github.com/Disane87/Klar/commit/41e9f64f6cb9cbc3b687c714a357330106a69f4b))

# [1.13.0](https://github.com/Disane87/Klar/compare/v1.12.0...v1.13.0) (2026-05-06)


### Features

* **oauth:** auto-detect MCP client name from initialize, allow user rename ([89a635e](https://github.com/Disane87/Klar/commit/89a635e380224c1f6935d19ce6d26746024b6e6d))

# [1.12.0](https://github.com/Disane87/Klar/compare/v1.11.0...v1.12.0) (2026-05-06)


### Features

* **mcp:** add update/delete tools and move connected-apps into a dialog ([822b85e](https://github.com/Disane87/Klar/commit/822b85ed27a9330eb952779b62a8615343b26715))

# [1.11.0](https://github.com/Disane87/Klar/compare/v1.10.0...v1.11.0) (2026-05-06)


### Bug Fixes

* **settings:** update additionalDirectories path to Klar workspace ([82129d5](https://github.com/Disane87/Klar/commit/82129d5b58e99930c726c27b2a0ffc2376ddd9a9))


### Features

* **mcp:** add OAuth bearer guard for resource server ([b225787](https://github.com/Disane87/Klar/commit/b2257877c17767e3872dac6c8dc3d9b6bf54d4a7))
* **mcp:** add read and write tools (transactions, recurring, categories, projects, budgets, overview) ([27aa802](https://github.com/Disane87/Klar/commit/27aa80269a2d5baa3408f3f70add98d1c088813e))
* **mcp:** add Streamable HTTP server skeleton with tool registry ([2e44dd8](https://github.com/Disane87/Klar/commit/2e44dd853f9673fa76548f32401bc230965343c9))
* **oauth:** add authorize endpoint with consent flow ([02f02e5](https://github.com/Disane87/Klar/commit/02f02e59cd8f027ddfcc06266ec2b971511bc929))
* **oauth:** add connected apps UI, revocation endpoint, cleanup cron ([d25dddf](https://github.com/Disane87/Klar/commit/d25dddf76007ddc9ebf49fe9d1a0b71ada86d396))
* **oauth:** add consent UI page with login return-url support ([0201879](https://github.com/Disane87/Klar/commit/02018794bae18828def13f4ba05a8bbf5ba7c8dc))
* **oauth:** add discovery endpoints (RFC 8414, RFC 9728) ([32029b1](https://github.com/Disane87/Klar/commit/32029b14db58b576f4bba248d6cd2c105cd24ce9))
* **oauth:** add dynamic client registration (RFC 7591) ([a5fc53b](https://github.com/Disane87/Klar/commit/a5fc53bbcc8c7f833c377a9f0a76c11098b8889f))
* **oauth:** add OAuth 2.1 schema and shared scopes for MCP ([50e676e](https://github.com/Disane87/Klar/commit/50e676e839ea13058ffcd40fa44a89d1b951f4d7))
* **oauth:** add token endpoint with PKCE and rotating refresh tokens ([b02a31e](https://github.com/Disane87/Klar/commit/b02a31e70d46fdcc521edcd94f312f0e372e1349))
* **oauth:** full OAuth+MCP flow e2e test, audit logging, hardening, docs ([693b260](https://github.com/Disane87/Klar/commit/693b2605fb52ef889fd6191e822d8aa2ff257fb3))
* **tests:** add new test commands for web and shared packages ([4fda403](https://github.com/Disane87/Klar/commit/4fda40369742da3f250e7e636ae03ad5820c71a6))

# [1.10.0](https://github.com/Disane87/Klar/compare/v1.9.0...v1.10.0) (2026-05-06)


### Features

* **avatar:** implement avatar upload and cropping functionality ([f4040ac](https://github.com/Disane87/Klar/commit/f4040acede7756289604f47c0fc6544b7636c653))

# [1.9.0](https://github.com/Disane87/Klar/compare/v1.8.1...v1.9.0) (2026-05-06)


### Bug Fixes

* **buchungen:** align row amount with group total via collapsible headers ([458e149](https://github.com/Disane87/Klar/commit/458e149e02d610439d46a79146f9142f6a493d02))
* **csv-import:** hovercard now projects into klar-list-item trailing slot ([60c556f](https://github.com/Disane87/Klar/commit/60c556fcd0ec71859f7ad294bbc51b8f20611831))
* **csv-import:** match fixed costs by token overlap, score by best amount/date diff ([960e557](https://github.com/Disane87/Klar/commit/960e557c77deb7e639d77127f25b8d4d5c2799e0))
* **csv-import:** rebuild preview row as CSS grid with fixed column tracks ([c2c98a7](https://github.com/Disane87/Klar/commit/c2c98a75636bee35fe5d8017893fd1aeaac7e0d5))
* **csv-import:** rename 'Vorschläge' chip to 'Fixkosten-Vorschläge', move next to Fixkosten ([c3d27a1](https://github.com/Disane87/Klar/commit/c3d27a1f23b17be907dfd24aa15e3d8f8c6c6fbc))
* **csv-import:** unblock submit when some rows lack category, prevent dup category create ([f5e88c0](https://github.com/Disane87/Klar/commit/f5e88c0a7d32d02b9613979daffdfd2ebab90462))
* **csv-import:** use namespace imports for iconv-lite and papaparse ([0c476ad](https://github.com/Disane87/Klar/commit/0c476ada7aec6d96a5501952fbd1525c03c43549))
* **klar-list-item:** add w-full and overflow-hidden so sublabel truncates ([62fb4fc](https://github.com/Disane87/Klar/commit/62fb4fce7d449c21112066fbf00c9187f7d52829))
* **ui:** use BrnPopover (umbrella export) instead of BrnPopoverComponent ([44a0489](https://github.com/Disane87/Klar/commit/44a0489c5566095f546ccae1093a5415499e1989))


### Features

* **buchungen:** add icons + colors to stat strip, rename Netto -> Bilanz ([858998f](https://github.com/Disane87/Klar/commit/858998f2e9eb96194c702ea56be1b44ee2351b3b))
* **buchungen:** group transactions by category like fixkosten ledger ([2a34e32](https://github.com/Disane87/Klar/commit/2a34e32c3751c6048804ac44423a701f6e6b3abb))
* **buchungen:** show counterparty as title, description as sublabel ([29fae5d](https://github.com/Disane87/Klar/commit/29fae5db6eedf7414ac7148d70eba99a007a9942))
* **buchungen:** use klar-combobox for category in transaction dialog ([7219f6f](https://github.com/Disane87/Klar/commit/7219f6f4d2a9208a4fd7a07fdbe73db3e040275c))
* **csv-import:** add counterpartyKey and rowHash utils ([08ef5d7](https://github.com/Disane87/Klar/commit/08ef5d7d5bb39a01fe51b06281e503018c9e5f48))
* **csv-import:** add detection modules (duplicate, fixed-cost, recurring, category) ([f97f543](https://github.com/Disane87/Klar/commit/f97f5430c6e6c3f0eb04e1f606f36eb7299a51e5))
* **csv-import:** add page header and virtual scroll for large CSV previews ([1799584](https://github.com/Disane87/Klar/commit/17995844257406922ae1c8973c9abed2a717d389))
* **csv-import:** add service, controller, repository and module wiring ([157b9b9](https://github.com/Disane87/Klar/commit/157b9b975a40266aa65bfa98ba1e79457e724bfa))
* **csv-import:** add Sparkasse CAMT v2 parser with Win-1252 decoding ([2bb7d0f](https://github.com/Disane87/Klar/commit/2bb7d0f170cfd6f1b80e8d83446d407fe1a8154b))
* **csv-import:** detect recurring patterns inside the current CSV, not just history ([8c9d62c](https://github.com/Disane87/Klar/commit/8c9d62cb3b5cc771ec5ee58e841909fa0441045a))
* **csv-import:** detect WEEKLY and HALF_YEARLY recurring patterns ([cda2c04](https://github.com/Disane87/Klar/commit/cda2c0441dee23a53589fa63167839681c8eeb71))
* **csv-import:** fixed-cost override, hovercard with match details, dialog-based category create ([470c459](https://github.com/Disane87/Klar/commit/470c459c9bfa4b6756ed10d041c151471fb30466))
* **csv-import:** global select-all + collapsible month groups ([fcde800](https://github.com/Disane87/Klar/commit/fcde800078b6cdbc3b4dec5fe125a9e026d5115a))
* **csv-import:** group preview rows by month with select-all per group; fix CDK width ([24f5fe3](https://github.com/Disane87/Klar/commit/24f5fe3cde9addfec30ef46228cd9a19f5ec7848))
* **db:** add CsvImport, ImportLearning tables and Transaction external fields ([d4343c5](https://github.com/Disane87/Klar/commit/d4343c52a0d6444a1bac2951728c9a8557c3f54e))
* **fixkosten:** rework recurring dialogs for new frequencies and category combobox ([e3c7efa](https://github.com/Disane87/Klar/commit/e3c7efa282d91f17f0bff2a38f064860b2c7ec3e))
* **fixkosten:** show period amount with monthly equivalent as secondary ([e88e6f7](https://github.com/Disane87/Klar/commit/e88e6f785cb856f8438d7297a705f0405cf16047))
* **klar-list-item:** add klarLeading/klarTrailing slots; reuse for CSV preview ([5ea89fd](https://github.com/Disane87/Klar/commit/5ea89fd0e8d6d87c08af15701730f2a896e3a69e))
* **shared:** add WEEKLY and HALF_YEARLY recurring frequencies ([0a7e50d](https://github.com/Disane87/Klar/commit/0a7e50d00621548bfbaa23111e4e2d82292b124f))
* **ui:** extract klar-summary-strip, share between fixkosten and buchungen ([27942e1](https://github.com/Disane87/Klar/commit/27942e113c6b9a214052cb3d67000b2f12b77f4a))
* **ui:** generic klar-combobox with inline create, wired into CSV import ([fc7feeb](https://github.com/Disane87/Klar/commit/fc7feeb40100b9434ac95c7b51af3f36b5517001))
* **ui:** generic klar-toolbar shared by fixkosten and buchungen ([fca6db9](https://github.com/Disane87/Klar/commit/fca6db9ea47c2d722d551047e65894ab3ffef1f3))
* **ui:** hoverCard input on klar-avatar (passthrough via klar-list-item) ([5bdd93b](https://github.com/Disane87/Klar/commit/5bdd93ba2552361c26004f911972ae2d04711953))
* **web:** add CSV import wizard page with upload, preview and summary ([8f4ed7e](https://github.com/Disane87/Klar/commit/8f4ed7eff4cd683b7f94de838fed24ad98b503f3))
* **web:** surface WEEKLY and HALF_YEARLY in csv-import and planspiel ([b23d2bc](https://github.com/Disane87/Klar/commit/b23d2bcc2e78c4fb703edfdf9db7a542cd6f3b4a))

## [1.8.1](https://github.com/Disane87/Klar/compare/v1.8.0...v1.8.1) (2026-05-06)


### Bug Fixes

* **vscode:** update TypeScript formatter and add npm exclusion ([868777c](https://github.com/Disane87/Klar/commit/868777c6ede446b8818255547df5c05aad167adf))

# [1.8.0](https://github.com/Disane87/Klar/compare/v1.7.0...v1.8.0) (2026-05-05)


### Features

* **projects:** project detail page with planned/realized transactions ([71c1f20](https://github.com/Disane87/Klar/commit/71c1f20c32ea475c094fb5ab605b243974b63d53))

# [1.7.0](https://github.com/Disane87/Klar/compare/v1.6.0...v1.7.0) (2026-05-05)


### Features

* **projects:** add project create dialog and frontend service ([72c469c](https://github.com/Disane87/Klar/commit/72c469ce046718c2c767d84d67a6d3568c8be254))

# [1.6.0](https://github.com/Disane87/Klar/compare/v1.5.0...v1.6.0) (2026-05-05)


### Bug Fixes

* **auth:** consume invite token after email verification ([ff91bc3](https://github.com/Disane87/Klar/commit/ff91bc3d5704d796024ea422f73e2de83dd24d72))
* **overview:** sort FIXED_INCOME before INCOME in fixed costs ([55bbb87](https://github.com/Disane87/Klar/commit/55bbb87dbaa43797abe4258dd24628e0a510d0e6))


### Features

* **admin:** add admin area with email log and owner/admin guards ([d24c42c](https://github.com/Disane87/Klar/commit/d24c42c672e4eee841dbab42528b556d29f4d64c))
* **categories:** expand CategoryType taxonomy with fixed/variable/savings split ([28da62a](https://github.com/Disane87/Klar/commit/28da62ab0a6f2cc765656812777bb30d1dad5f13))
* **categories:** owner-only category management in Haushalt page ([6ca3699](https://github.com/Disane87/Klar/commit/6ca369923434d8305e6fbe4ee733f603310cc65f))

# [1.5.0](https://github.com/Disane87/Klar/compare/v1.4.2...v1.5.0) (2026-05-05)


### Features

* **web:** show invite hint on login page when joining via invite link ([f77cec9](https://github.com/Disane87/Klar/commit/f77cec9a0fb03313034953b3a15663811b30d4de))

## [1.4.2](https://github.com/Disane87/Klar/compare/v1.4.1...v1.4.2) (2026-05-05)


### Bug Fixes

* improve error handling for 401 responses in refresh interceptor ([eb88e05](https://github.com/Disane87/Klar/commit/eb88e05a5f4615ad8314f303bef6f51bc0908f43))

## [1.4.1](https://github.com/Disane87/Klar/compare/v1.4.0...v1.4.1) (2026-05-05)


### Bug Fixes

* remove unused KlarIconComponent import and update allowed bash commands in settings ([407b012](https://github.com/Disane87/Klar/commit/407b012054cf0ff7969d495b248bbe9fc9bb028f))

# [1.4.0](https://github.com/Disane87/Klar/compare/v1.3.0...v1.4.0) (2026-05-05)


### Features

* **web:** add bulk select & delete on fixkosten ([b2e2537](https://github.com/Disane87/Klar/commit/b2e25378fb6f4c1239269faff419880a1d768b16))

# [1.3.0](https://github.com/Disane87/Klar/compare/v1.2.4...v1.3.0) (2026-05-05)


### Bug Fixes

* **api:** let static file middleware fall through to API routes ([afb4034](https://github.com/Disane87/Klar/commit/afb40343a85e9a06c55abb8338d3a1fd03490c06))


### Features

* **web:** introduce klar-button wrapper and migrate all hlmBtn usages ([750b60a](https://github.com/Disane87/Klar/commit/750b60a02c86fa5696082addf8bbdffb1921d06c))
* **web:** scale desktop UI 125% and refine fixkosten PDF export ([78e3524](https://github.com/Disane87/Klar/commit/78e3524d9f026900eecdba5ab520a6ef83c15657))

## [1.2.4](https://github.com/Disane87/Klar/compare/v1.2.3...v1.2.4) (2026-05-05)


### Bug Fixes

* **web:** adjust iOS PWA safe-area handling ([#9](https://github.com/Disane87/Klar/issues/9)) ([d69c417](https://github.com/Disane87/Klar/commit/d69c417349a860dacc44a150aa1592396713671c))

## [1.2.3](https://github.com/Disane87/Klar/compare/v1.2.2...v1.2.3) (2026-05-05)


### Bug Fixes

* **web:** keep stores reactive after mutations ([6712b94](https://github.com/Disane87/Klar/commit/6712b9436f0247121205cb745b62953d807688e3))

## [1.2.2](https://github.com/Disane87/Klar/compare/v1.2.1...v1.2.2) (2026-05-05)


### Bug Fixes

* **shell:** make update banner span full viewport width ([6d20342](https://github.com/Disane87/Klar/commit/6d20342106d757860d618c3bc0b03997b3877e1f))

## [1.2.1](https://github.com/Disane87/Klar/compare/v1.2.0...v1.2.1) (2026-05-05)


### Bug Fixes

* **release:** hardcode lowercase ghcr owner in publishCmd ([a8a0f30](https://github.com/Disane87/Klar/commit/a8a0f3001c4d466a118fe30f128342ff39814154))

# [1.2.0](https://github.com/Disane87/Klar/compare/v1.1.0...v1.2.0) (2026-05-05)


### Features

* **system-page:** markdown changelog with scroll and last-checked timestamp ([216003f](https://github.com/Disane87/Klar/commit/216003f44fe59de1732a230106da7853d1b12718))

# [1.1.0](https://github.com/Disane87/Klar/compare/v1.0.0...v1.1.0) (2026-05-05)


### Features

* **ui+invites:** KlarAvatar-Komponente + email-aware Invite-Flow ([0185c8b](https://github.com/Disane87/Klar/commit/0185c8b4bae4cacacaf14a02ee4e366b8792992c))

# 1.0.0 (2026-05-05)


### Bug Fixes

* @klar/shared coverage-Threshold — type-only Dateien aus Coverage ausschließen ([db2d27f](https://github.com/Disane87/Klar/commit/db2d27f8ee3f8512a99930a7d8ad5ddef977d927))
* **api-keys:** remove public API controller and fix incremental build ([e6a95d7](https://github.com/Disane87/Klar/commit/e6a95d7fed9ca11bbe8910252f9aa6b8a1e489e2))
* **api:** use named wildcard in ServeStaticModule exclude pattern ([3313081](https://github.com/Disane87/Klar/commit/3313081e943b81b7ca291ef9a58e2eacdecc4275))
* avatar-Upload von multipart auf JSON+Base64 umstellen ([850b2bc](https://github.com/Disane87/Klar/commit/850b2bc0f3815baada148d6c2826bbc855127f19))
* **build:** remove eager @iconify-json/simple-icons bulk import ([9b3df82](https://github.com/Disane87/Klar/commit/9b3df82b6d9d94ef1f410cc38ed259718c56df12))
* **build:** set rootDir and include in tsconfig.build.json to fix dist output path ([6b87d77](https://github.com/Disane87/Klar/commit/6b87d77685819527db29b7e68730ae3e78300f86))
* **ci:** broaden coverage exclusions — guards, decorators, DTOs are not unit-testable ([abe40e9](https://github.com/Disane87/Klar/commit/abe40e911a9d30835d853c5a9783d95ed48cee32))
* **ci:** build shared before lint, fix auth mock returning undefined ([24518a5](https://github.com/Disane87/Klar/commit/24518a5e2fb7331586a8c1502825b52e40a9211d))
* **ci:** fix 3 failing tests + align coverage threshold ([1115258](https://github.com/Disane87/Klar/commit/1115258036e79f8b660015438a2ccb538f33d67c))
* **ci:** fix remaining TypeScript errors in service specs ([daff40a](https://github.com/Disane87/Klar/commit/daff40ae76f76d2019e1a696e59cd155deb289a9))
* **ci:** generate Prisma client before lint and tests ([269a128](https://github.com/Disane87/Klar/commit/269a1281c995ecb19d0843594592f81bb519d03b))
* **ci:** remove explicit pnpm version — read from packageManager field ([03195a9](https://github.com/Disane87/Klar/commit/03195a91db4715b3fd9f9e659227e6ef8b9ad104))
* close-btn min-touch-target 44px, remove double-emit from HlmCheckboxComponent ([68f7bd6](https://github.com/Disane87/Klar/commit/68f7bd680414018d684fb59d99cf17ab56ece8ad))
* **deps:** add @fastify/static required by ServeStaticModule with Fastify ([86c50aa](https://github.com/Disane87/Klar/commit/86c50aa8d14204b283ebb4ba3c24e891bbd345eb))
* **docker:** copy apps/api/node_modules into runner for pnpm dep resolution ([bd4a37b](https://github.com/Disane87/Klar/commit/bd4a37b6d30c1e6fb8be8b78eb95da449537560d))
* **docker:** copy packages/shared/node_modules so zod resolves correctly ([5167ddf](https://github.com/Disane87/Klar/commit/5167ddfa5ab81e052ac2628f42f1e7a4d54006c5))
* **docker:** generate Prisma client in builder stage ([830591b](https://github.com/Disane87/Klar/commit/830591b80ed5aa6f488a9075c8c20de6fc788e96))
* expose error signal on CategoriesStore ([456d0d5](https://github.com/Disane87/Klar/commit/456d0d528280663c97e05b908978db86ef2e9942))
* **fixkosten:** add safe-area-inset bottom padding to scrollable containers ([62e1b20](https://github.com/Disane87/Klar/commit/62e1b20748c0975226c2245b9740ae301087a616))
* form inputs/selects 16px for iOS Safari (recurring-edit-dialog) ([3738b89](https://github.com/Disane87/Klar/commit/3738b890814beb148cde926b6ff1e37fbd5944e5))
* haushalt page full-width layout on desktop ([bca25f0](https://github.com/Disane87/Klar/commit/bca25f0cede5b2b7e6e05f9a3f622fd5a6bae51e))
* **haushalt:** add [hlmSelect] directive to member role select ([839eff1](https://github.com/Disane87/Klar/commit/839eff1c3faccaf57fa05ec1a5932e774dbf07e5))
* **households:** InvitationLink-Modell ins Prisma-Schema ergänzt und as-any bereinigt ([ba07f90](https://github.com/Disane87/Klar/commit/ba07f907337b04e04c6a4eb9ce80621d8aa34753))
* **import-dialog:** Spartan UI Controls durchgängig — hlmSelect + hlmLabel ([f7d2e33](https://github.com/Disane87/Klar/commit/f7d2e332738a0a46ef4a820b33128a1dfda3bda8))
* **interceptors:** externe HTTP-Requests von Auth/Error-Handling ausschließen ([ba9b20f](https://github.com/Disane87/Klar/commit/ba9b20fa2d09a8702dee50d72ac3fecf4175a546))
* **mail:** make SMTP optional and add auth support ([0142d24](https://github.com/Disane87/Klar/commit/0142d2485a9721bf0bdf2b72007201e1752fec75))
* mobile nav styling and dialog centering ([73e8d3d](https://github.com/Disane87/Klar/commit/73e8d3da27484cd11a0812365f789a29464f2181))
* page :host flex layout — consistent flex:1 + min-height:0 + overflow:hidden ([2499a70](https://github.com/Disane87/Klar/commit/2499a70d7d46b59abbefc2952f37fc1c3656ab32))
* pass iss parameter to openid-client callback and add error logging ([e2c329d](https://github.com/Disane87/Klar/commit/e2c329d2e26be93a30aef18276e1d629bb94a267))
* post-phase-11 bug fixes (auth, interceptor, ui) ([5af1712](https://github.com/Disane87/Klar/commit/5af17127d85c64d93bd5395a1b71f3d117aee5bb))
* quality fixes — ngOnInit void-safe, role guard, font-mono inline style removed ([610c5ea](https://github.com/Disane87/Klar/commit/610c5ea54edb2c2e0d2377368829b81bd698446b))
* rebuild import mapping dialog — plain selects, stacked layout, visible labels ([051de7d](https://github.com/Disane87/Klar/commit/051de7d71d3f9f69100ecfebe19b59fc1214c3d8))
* remove unused KlarSkeletonRowsComponent import from settings page ([0c590de](https://github.com/Disane87/Klar/commit/0c590de7021dcd24fa1111351d18c1ef9020a7ba))
* resolve CI pipeline TypeScript errors in vitest configs and spec ([67d9491](https://github.com/Disane87/Klar/commit/67d949109b85aff09a0335c968aeb50d5ce131ba))
* **security:** fastify 5.8.4 transitive dep via pnpm override auf 5.8.5 fixieren ([4471ce8](https://github.com/Disane87/Klar/commit/4471ce8cdd4469ea216be1cc0cb319b46f7dc1fa))
* **security:** nodemailer 8.0.7 + fastify 5.8.5 — Dependabot High/Medium fixes ([1a68ea4](https://github.com/Disane87/Klar/commit/1a68ea44a2912cee90076c47409600eeada265fa))
* **spartan:** complete planspiel controls migration to hlmInput/hlmLabel/hlmSelect ([6bed43d](https://github.com/Disane87/Klar/commit/6bed43dddc6eb1a02b8160daa27a7c1d5af93cc1))
* **test:** household.service.spec auf Invitation-Links-API aktualisieren ([426894c](https://github.com/Disane87/Klar/commit/426894cbafdcfc6edde959f96a42be68dd424f0c))
* **test:** lower coverage threshold to 30% for web tests ([c182b2f](https://github.com/Disane87/Klar/commit/c182b2fb67323e28815735050ecbab92793386b9))
* top-bar full-width — .topbar width: 100% ([36dfb6b](https://github.com/Disane87/Klar/commit/36dfb6bfdf685b8dbdc43087f6c0760c81ef554a))
* **turbo:** complete globalEnv with JWT/app vars, remove stale .next output ([6d27221](https://github.com/Disane87/Klar/commit/6d27221033ac0909b0f94d43dbd9eabbc14660a2))
* **ui:** mobile chip uses chipLabel override; stat [@for](https://github.com/for) tracks by index ([4b11717](https://github.com/Disane87/Klar/commit/4b1171798e63cd5cfcb49f36d4224430dd118f00))
* **ui:** various UI polish and dead button fixes across pages ([ed56503](https://github.com/Disane87/Klar/commit/ed565033686f2145254228920fb67bf0e3cfc62d))
* unused Angular imports entfernen (DatePipe, DataExport/Import aus template-imports) ([eea5e57](https://github.com/Disane87/Klar/commit/eea5e5787cd6bd6030aa87d21ff61e0f6abbb8cf))
* use --color-primary for ::selection (--color-accent is now hover surface) ([05bf08e](https://github.com/Disane87/Klar/commit/05bf08ede91186888e8ee6e81fb14a9f33f4bae9))
* use [selected] on options for async-loaded category/frequency selects ([22cbb3b](https://github.com/Disane87/Klar/commit/22cbb3b529e665d1bfc20103cf35128734584911))
* use explicit 302 + location header in OIDC callback instead of reply.redirect() ([042dc3b](https://github.com/Disane87/Klar/commit/042dc3b4b8ec1fa2f2b06376583861507385f958))
* **web:** address quality review findings for Angular bootstrap ([c0e072b](https://github.com/Disane87/Klar/commit/c0e072b82855a1b1d97085fde8be042c5a29535f))
* **web:** repair Haushalt page visual rendering ([2f6c29b](https://github.com/Disane87/Klar/commit/2f6c29be2cbb44fb772e90cf02b100b95973a0fc))
* **web:** wire up Tailwind v4 utilities + button outline variant ([9612725](https://github.com/Disane87/Klar/commit/96127251e007ac4e54182b6283190fd8df5b235d)), closes [#71717a](https://github.com/Disane87/Klar/issues/71717a)
* wire top-bar button actions, full-width header on all pages ([a252ccc](https://github.com/Disane87/Klar/commit/a252cccba97a564d1c75778bf37f76e01f62209d))


### Features

* add color and icon picker to fixkosten with klar-list components ([d00e387](https://github.com/Disane87/Klar/commit/d00e3871e009d64c6ef5068561c9ab487691e72a))
* add mail template management and 2FA settings improvements ([7421123](https://github.com/Disane87/Klar/commit/7421123c13b1207ad77664e53b2606edd7b630bc))
* add Playwright E2E test suite (49 tests, web frontend) ([7d2e337](https://github.com/Disane87/Klar/commit/7d2e337868bfe65e0538e94d530b494caa898a67))
* add refined logo mark to sidebar header ([fd65b79](https://github.com/Disane87/Klar/commit/fd65b795e73d5314da59ae45e7345142c4b5c110))
* add savings card, improve auth pages, fix sidebar/header alignment ([177e426](https://github.com/Disane87/Klar/commit/177e4260481dd26d41677b9193f97df4a99b1ed9))
* **api:** /health endpoint (TDD — Red→Green) ([9f5ec3b](https://github.com/Disane87/Klar/commit/9f5ec3b4d3d2d713bff16dc4c0cd99e50db3e012))
* **api:** add createdBy and createdById to overview response ([6081639](https://github.com/Disane87/Klar/commit/6081639cf7c04d83ff3375a14522521f1684be55))
* **api:** GlobalExceptionFilter RFC 7807 (TDD — Red→Green) ([2de0704](https://github.com/Disane87/Klar/commit/2de07049ba62b49830ce602329556620d59a8c40))
* **api:** JWT RS256 keys:generate script (idempotent) ([eef43db](https://github.com/Disane87/Klar/commit/eef43db990473c210a55ae4755d391f589e999a5))
* **api:** NestJS 11 + Fastify 5 + Pino bootstrap ([6930a55](https://github.com/Disane87/Klar/commit/6930a55b752c45903721fd68af31cda4dec9bd72))
* **auth:** embed refreshTokenId in JWT access token ([d6f4f08](https://github.com/Disane87/Klar/commit/d6f4f08053291dc01879f77e02fa3e4e599fcb3e))
* avatarUrl in Haushalt-Mitgliederliste und Fixkosten-Filter anzeigen ([398b243](https://github.com/Disane87/Klar/commit/398b2431535a98ccf3823d859b3efba6f53a8702))
* brand icons in fixkosten ledger rows ([c98bbf7](https://github.com/Disane87/Klar/commit/c98bbf7664d94ed64ba63412da05e531df219d8e))
* BrandIconComponent with Iconify Simple Icons ([2dbd1f6](https://github.com/Disane87/Klar/commit/2dbd1f6dde3e6dc2c307fbe7e88339be7bbac440))
* buchungen page — edit/create via dialog, brand icons in rows ([3764002](https://github.com/Disane87/Klar/commit/3764002542b47cbdff0a4232d51cd8ef3fefcee0))
* CategoriesStore + categoryId on FixedCostItem ([4e2bd5f](https://github.com/Disane87/Klar/commit/4e2bd5f6e89035c433b38eecd7488b83e986b3f1))
* consolidate API and Web into single Docker image ([d956dac](https://github.com/Disane87/Klar/commit/d956dac2ff3d3168761de94c29326ee0facb349d))
* docker-compose.dev.yml, .vscode workspace, GitHub Actions CI ([8083cc8](https://github.com/Disane87/Klar/commit/8083cc86b013b9ba90e11f3b9eaab5d5978a6493))
* Einladungslinks ersetzen altes InviteCode-System ([a519199](https://github.com/Disane87/Klar/commit/a5191995f2b226a7280dc2d1c8a6df12dfe25da6))
* **fixkosten:** add DIN A4 PDF export with summary ratings ([33dfd06](https://github.com/Disane87/Klar/commit/33dfd0609b06b8db7db9a4618a16af01ba933c59))
* **fixkosten:** add frequency color coding with colored icons and legend footer ([d08a4ff](https://github.com/Disane87/Klar/commit/d08a4ff8c1cea0e793b75a1e280f3e879ff15caf))
* **fixkosten:** add recurring transaction create dialog and calendar legend ([efe55b9](https://github.com/Disane87/Klar/commit/efe55b9c420949cf04072a45110ae2a1a44a1f17))
* **fixkosten:** zero chrome — remove stat strip, 26px rows, inline freq suffix ([d2d763b](https://github.com/Disane87/Klar/commit/d2d763ba6c8183fd1874e3e6dc21fd029400a43d))
* generate PWA icons, favicons, OG image and refine logo mark ([5a0af1e](https://github.com/Disane87/Klar/commit/5a0af1e6b8a48fd223ac9e90c7324af2cd21818b))
* **haushalt:** member role change with select + confirmation ([58ab5ea](https://github.com/Disane87/Klar/commit/58ab5ead2763641873464f4097f32514877dea0f))
* header redesign + user avatar upload ([#6](https://github.com/Disane87/Klar/issues/6)) ([f2abda6](https://github.com/Disane87/Klar/commit/f2abda6db8040ccca562b814a021f3aca180fda2))
* **health:** version-aware health endpoint + System-Seite im Frontend ([2282eb5](https://github.com/Disane87/Klar/commit/2282eb5e10ad00b93d9a46c0e8e4c286b27ca087))
* **household:** add household management page with member admin and settings integration ([bf5df14](https://github.com/Disane87/Klar/commit/bf5df140951b404b81607b8951ec5647f21c8ef4))
* **households:** member role change endpoint with owner-count guard ([6280925](https://github.com/Disane87/Klar/commit/6280925955bdad8b24df3d7988ca73a8df155219))
* implement 2FA with TOTP and QR code generation ([3890fff](https://github.com/Disane87/Klar/commit/3890fff5ebf9f38afa1b5c17e2ac8f9001e27fd3))
* Initial implementation of Denaro budget tracking app ([072ccc1](https://github.com/Disane87/Klar/commit/072ccc1beecf0cff39636cccbd7dc06b631af549))
* JSON Import/Export + Theme Toggle Group ([#8](https://github.com/Disane87/Klar/issues/8)) ([bacfe33](https://github.com/Disane87/Klar/commit/bacfe337713a52f941ed5f4c79b2f3c15e0c2c60))
* KlarDialog system — global dialog service + overlay component ([c85dde5](https://github.com/Disane87/Klar/commit/c85dde55c024c09ce7121f3bcfed0b93cde79e19))
* **mail-templates:** CodeMirror-Editor, Preview und Delivery-Seeding ([b099abb](https://github.com/Disane87/Klar/commit/b099abb27bd86b3233c655d5dd2324662f443510))
* Phase 10 — API Keys (bgb_live_ prefix, Argon2id, scope guards) ([d89836a](https://github.com/Disane87/Klar/commit/d89836ac64f07811ff62676627ae93b4e008b66f))
* Phase 11 — Planspiel store, TransactionStore, wired Angular UI ([fd47769](https://github.com/Disane87/Klar/commit/fd47769e696bc056035b5604e5e81641a5a71c41))
* Phase 2+3 — local auth, households, invite codes, RLS, onboarding ([5084a5d](https://github.com/Disane87/Klar/commit/5084a5ddbdbf90be0082da7b74160bd3acc6e599))
* Phase 4 — OIDC via PocketID (PKCE, JIT provisioning, group mapping) ([970d651](https://github.com/Disane87/Klar/commit/970d65114d0bb2d85f0eed7105903b0add3d6063))
* Phase 5 — Categories + Projects (CRUD, visibility, soft-delete) ([4e25abe](https://github.com/Disane87/Klar/commit/4e25abedcc046c845accecf685ae125d91f28188))
* Phase 6 — Recurring Transactions (CRUD, frequency logic, safeDayOfMonth) ([971cd0e](https://github.com/Disane87/Klar/commit/971cd0e41c1ce2ad634e3cdd52601e55c6023150))
* Phase 7 — Transactions + Budgets (CRUD, PRIVATE guard, month normalization) ([01a5128](https://github.com/Disane87/Klar/commit/01a5128fc9fda838fac798e1e329ff273d49a527))
* Phase 8 — Shared calculation functions (single source of truth) ([48c8dea](https://github.com/Disane87/Klar/commit/48c8dea220a64d55cf90b5190f8b2d1f23c0a1ab))
* Phase 9 — Overview endpoints + Angular overview stores ([c7b963e](https://github.com/Disane87/Klar/commit/c7b963ef2bc2d57fbde80aa6dce1aa3049fc3ad6))
* **planspiel:** add Planspiel mode with in-memory what-if analysis ([dc3c59a](https://github.com/Disane87/Klar/commit/dc3c59a23c3d274014cc59db52ce7b9b0eed2a6e))
* recurring-edit dialog — category, frequency, day-of-month editable ([a660711](https://github.com/Disane87/Klar/commit/a660711a4b14ba2c80fac832d290ecb31d27060f))
* refactor auth pages with Tailwind, improve mobile UX ([6ac4961](https://github.com/Disane87/Klar/commit/6ac4961528395ecf6800e5f82dea00c706627111))
* **settings:** ChangePasswordDialog and DeleteAccountDialog components ([c27b07e](https://github.com/Disane87/Klar/commit/c27b07ecb26733af42e4e2f0043197d89ecb135f))
* **settings:** SettingsPageComponent with all sections + /app/settings route ([65a39bd](https://github.com/Disane87/Klar/commit/65a39bdae0354dbd4e0ba6d8b3d7a972b4571dae))
* **settings:** ThemeService, UserSettingsService, UserSettingsStore ([01a0779](https://github.com/Disane87/Klar/commit/01a0779d58da0024f03b8c1afe2adb11e547156f))
* **shared-frontend:** bootstrap with ApiClient, toHttpParams, ResourceStore stub ([338cbfe](https://github.com/Disane87/Klar/commit/338cbfe096077c7a0713100e71570070e2322b19))
* **shared:** add UserProfile, Session, OidcIdentity, ChangeRole types ([305534d](https://github.com/Disane87/Klar/commit/305534d29108aea32ecdc11240384a46269c4138))
* **shared:** bootstrap shared package — types, calculations, TDD tests ([13c9f05](https://github.com/Disane87/Klar/commit/13c9f059acc0a246b44cbc9fb31fd03dffa158ea))
* **shell:** add Tresor placeholder page and update navigation layout ([36b5f88](https://github.com/Disane87/Klar/commit/36b5f8857346f5461432b8b17ae7f40d9cd4be8c))
* Spartan UI migration, shared components, settings page, haushalt role management ([039d0a4](https://github.com/Disane87/Klar/commit/039d0a4867cf3efcf9c16ea634779f99c31dc8d9))
* **spartan:** HlmBadgeDirective, update klar-badge to use spartan variants ([cd1cdea](https://github.com/Disane87/Klar/commit/cd1cdeaad1f6c9027783390dc5a1528c742b75f9))
* **spartan:** HlmInputDirective + HlmLabelDirective + HlmErrorDirective, update klar-input internals ([8fae01a](https://github.com/Disane87/Klar/commit/8fae01ad7f8c770a95d886f9cfb21d2ffa499494))
* **spartan:** HlmSelectNativeDirective for styled native <select> elements ([e6c64bc](https://github.com/Disane87/Klar/commit/e6c64bc819566a927c0886044406712caa4da92c))
* **spartan:** migrate all remaining raw controls to hlm directives (dialogs, planspiel, haushalt) ([3712d91](https://github.com/Disane87/Klar/commit/3712d916a2e78caa5206d6d377d8017b7c11e9ff))
* **spartan:** migrate KlarDialog to CDK Dialog, remove shell outlet ([fe4f7cd](https://github.com/Disane87/Klar/commit/fe4f7cd786911d910ed0f28d73426455cdb016f3))
* **spartan:** replace klar-button with HlmButtonDirective across all pages ([b0c708a](https://github.com/Disane87/Klar/commit/b0c708a74e5053515e362edc18fba68e8527a21e))
* TransactionDialogComponent — combined create/edit ([7ad3ab6](https://github.com/Disane87/Klar/commit/7ad3ab684aafe9925b8dfd20bde45d53efcc8515))
* TransactionsService — create, patch, delete ([4d1845e](https://github.com/Disane87/Klar/commit/4d1845eb3bf4104db5b2d0b8b5b0b5995d8bc334))
* **ui:** add stats/chipLabel signals to PageHeaderService and TopBar ([189f436](https://github.com/Disane87/Klar/commit/189f4364289f825928669736e49db2a32ded8c3c))
* **users:** add profile update, soft-delete, OIDC unlink repo methods ([c36c673](https://github.com/Disane87/Klar/commit/c36c6738fe6fd32408bbbee5974783691e347d4a))
* **users:** profile, password change, OIDC unlink, sessions, account delete ([04d602e](https://github.com/Disane87/Klar/commit/04d602e0535a662bfb9b174079c3c0f988b44a65))
* **users:** REST endpoints for profile, sessions, OIDC, account delete ([ba04034](https://github.com/Disane87/Klar/commit/ba040344b2dd77d14066b9bbe989fd9b4d151bd5))
* **web:** @angular/pwa with iOS meta-tags, manifest, ngsw-config ([c044994](https://github.com/Disane87/Klar/commit/c044994e25dc391641160a9cb088bb02879181ed))
* **web:** Angular 21 zoneless bootstrap with Vitest smoke test ([5c97174](https://github.com/Disane87/Klar/commit/5c97174aa3811f7fe39c5245108a3918288046a7))
* **web:** implement Klar Design System — tokens, icons, UI components, shell ([710ae81](https://github.com/Disane87/Klar/commit/710ae81abe86b5efbd0d27d4d8b0661429a011d3))
* **web:** Tailwind 4 with class-based dark mode and semantic color tokens ([46774e8](https://github.com/Disane87/Klar/commit/46774e8366291581027cec2b609840a0828adcc6))
