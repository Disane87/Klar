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
