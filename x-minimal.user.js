// ==UserScript==
// @name         X 極簡｜新舊介面・背景圖片・毛玻璃
// @namespace    local.x-minimal
// @version      1.12.3
// @description  精簡 X 新舊介面，自訂背景與 Liquid Glass，附媒體下載與紀錄、影片音量記憶與平衡、選用跨裝置同步及繁體中文設定。
// @author       TW527E
// @homepageURL  https://github.com/TW527E/X-Minimal
// @match        https://x.com/*
// @match        https://twitter.com/*
// @match        https://www.x.com/*
// @match        https://www.twitter.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addValueChangeListener
// @grant        GM_download
// @grant        GM_xmlhttpRequest
// @connect      script.google.com
// @connect      script.googleusercontent.com
// @connect      cdn.syndication.twimg.com
// @sandbox      DOM
// @run-at       document-end
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
  'use strict';
  if (document.getElementById('xm-settings')) return;

  const KEY = 'x-minimal-settings';
  const AUDIO_KEY = 'x-minimal-video-volume';
  const DOWNLOAD_KEY = 'x-minimal-download-history';
  const DOWNLOAD_DELETED_KEY = 'x-minimal-download-deleted';
  const SYNC_CONFIG_KEY = 'x-minimal-sync-config';
  const SYNC_META_KEY = 'x-minimal-sync-meta';
  const MAX_BACKUP = 32 * 1024 * 1024;
  let downloadHistory=Object.create(null),downloadDeleted=Object.create(null),syncController=null;
  try{downloadDeleted=normalizeDownloadDeleted(GM_getValue(DOWNLOAD_DELETED_KEY,{}));}catch{}
  try{
    const stored=normalizeDownloadHistory(GM_getValue(DOWNLOAD_KEY,{}));
    downloadHistory=pruneDownloadHistory(stored,downloadDeleted);
    if(Object.keys(stored).length!==Object.keys(downloadHistory).length)GM_setValue(DOWNLOAD_KEY,downloadHistory);
  }catch{}
  const INTERFACE_GLASS = '[data-xm-composer],[data-xm-page-glass],[data-xm-header],[data-xm-home-tabs],[role="tablist"]:has([role="tab"]),[data-slot="xds-menu-content"],[data-slot="xds-popover-content"],[data-slot="xds-hover-card-content"],[data-slot="xds-hovercard-content"],[data-testid="HoverCard"],[data-base-ui-focusable][data-open][data-side],[data-rootownerid][data-open]:not(button):not([role="tab"]),[role="tooltip"]:has(img),[role="menu"],[role="dialog"]';
  const MAX_IMAGE = 6 * 1024 * 1024;
  const NAV = [
    ['home', '首頁', ['/home']], ['explore', '探索', ['/explore']],
    ['notifications', '通知', ['/notifications']], ['messages', '訊息／Chat', ['/messages', '/i/chat']],
    ['calls', '通話', ['/i/calls']], ['grok', 'Grok', ['/i/grok', '/i/ai']],
    ['premium', 'Premium／訂閱', ['/i/premium', '/i/premium_sign_up', '/i/verified-choose']],
    ['history', '歷史紀錄', ['/i/history']], ['creator', '創作者工作室', ['/i/jf/creators', '/i/monetization']],
    ['lists', '列表', ['/i/lists']], ['bookmarks', '書籤', ['/i/bookmarks']],
    ['jobs', '工作', ['/jobs']], ['communities', '社群', ['/i/communities']],
    ['articles', '文章', ['/compose/articles', '/i/articles']], ['topics', '主題', ['/i/topics']],
    ['verified', '認證組織', ['/i/verified-orgs', '/i/verified-orgs-signup']],
    ['profile', '個人檔案', []], ['more', '更多', []]
  ];
  const ICONS = {
    home:'<path d="m3 10 9-7 9 7M5 9v11h14V9M9 20v-7h6v7"/>',
    explore:'<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 5 5"/>',
    notifications:'<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5zM10 21h4"/>',
    messages:'<path d="M21 11a9 9 0 0 1-9 9H4l-2 2v-10a9 9 0 1 1 19-1Z"/>',
    calls:'<path d="m7 3 3 5-3 3a15 15 0 0 0 6 6l3-3 5 3-1 4C10 23 1 14 3 4z"/>',
    grok:'<ellipse cx="12" cy="12" rx="9" ry="6" transform="rotate(-38 12 12)"/><path d="M3 22 21 2"/>',
    premium:'<path d="m12 2 3 2 4 1 1 4 2 3-2 3-1 4-4 1-3 2-3-2-4-1-1-4-2-3 2-3 1-4 4-1zM8 12l3 3 5-6"/>',
    history:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    creator:'<path d="M9 15 5 19M8 10l-4 1-2 5 6-1M14 16l-1 6 5-2 1-4M8 16C9 8 14 3 22 2c-1 8-6 13-14 14Z"/><circle cx="16" cy="8" r="2"/>',
    lists:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    bookmarks:'<path d="M5 3h14v19l-7-5-7 5z"/>',
    jobs:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 13h18M10 12v3h4v-3"/>',
    communities:'<circle cx="9" cy="7" r="3"/><circle cx="18" cy="8" r="2"/><path d="M2 21v-4a7 7 0 0 1 14 0v4zM17 14c3 0 5 2 5 5v2h-3"/>',
    articles:'<path d="M13 3H4v18h16v-9M8 8h3M8 12h2m3 4-3 1 1-3L20 5l2 2z"/>',
    topics:'<path d="M20 11a8 8 0 0 1-8 8H8l-4 3v-6A8 8 0 1 1 20 11ZM8 8h8M8 12h5"/>',
    verified:'<path d="m12 2 9 4v6c0 5-5 8-9 10-4-2-9-5-9-10V6zM8 12l3 3 5-6"/>',
    profile:'<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3z"/>',
    more:'<circle cx="12" cy="12" r="9"/><circle cx="7.5" cy="12" r=".8"/><circle cx="12" cy="12" r=".8"/><circle cx="16.5" cy="12" r=".8"/>'
  };
  const DEFAULTS = {
    enabled: true, width: 680, centerTimeline: false, hideSidebar: true, removeBorders: false, removePostBorders: false,
    stickyHeader: true, hideTopTabs: false, defaultFollowing: false, hideComposer: false, zen: false,
    hideAds: true, hideSuggestions: true, hideViewCount: true, hideReplyCount: false,
    hideRepostCount: false, hideLikeCount: false, hideFollowCount: false,
    navLabels: 'always', centerNav: false, hideLogo: false, hideUnread: false,
    navHidden: ['calls', 'grok', 'premium', 'history', 'creator', 'jobs', 'verified'],
    hideGrok: true, hideChatDrawer: false, hideSearch: false, hidePremiumUpsell: false, transparentSearch: false,
    hidePostButton: false, hideTitleCount: false, systemFont: false,
    background: '', backgroundFit: 'cover', backgroundPosition: 'center', backgroundDim: 12,
    timelineMode: 'solid', liquidLite: false, liquidTier: 'auto', opacity: 78, blur: 20, customCSS: '',
    rememberVideoVolume: true, balanceVideoAudio: true, mediaDownloadEnabled: true,
    fixupCopy: true, hideNativeCopyLink: false,
    navAlignLeft: false, rightAlignSidebar: false, readingTextTone: 'auto',
    sidebarMode: 'liquid', sidebarOpacity: 42, sidebarBlur: 20, sidebarLite: false, sidebarTier: 'auto', magneticCursor: false
  };

  function imageValue(value) {
    if (typeof value !== 'string' || value.length > MAX_IMAGE * 1.4) return '';
    if (!value) return '';
    if (/^data:image\/(png|jpeg|webp|gif|avif);base64,[a-z0-9+/=\s]+$/i.test(value)) return value;
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
    } catch { return ''; }
  }

  function normalize(value) {
    const result = { ...DEFAULTS, navHidden: [...DEFAULTS.navHidden] };
    if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
    for (const [key, fallback] of Object.entries(DEFAULTS)) {
      if (typeof fallback === 'boolean' && typeof value[key] === 'boolean') result[key] = value[key];
    }
    for (const [key, min, max] of [['width', 480, 1100], ['blur', 0, 60], ['opacity', 15, 100], ['backgroundDim', 0, 80], ['sidebarBlur', 0, 60], ['sidebarOpacity', 15, 100]]) {
      if (typeof value[key] === 'number' && Number.isFinite(value[key])) result[key] = Math.min(max, Math.max(min, value[key]));
    }
    for (const [key, allowed] of Object.entries({navLabels:['always','hover','hidden'], timelineMode:['solid','glass','liquid'], sidebarMode:['solid','glass','liquid'], backgroundFit:['cover','contain','repeat'], backgroundPosition:['center','top','bottom'],readingTextTone:['auto','light','dark']})) {
      if (allowed.includes(value[key])) result[key] = value[key];
    }
    // 輕量模式 is the second tier; older versions only know the boolean, so a change there wins.
    for (const [tier, lite] of [['liquidTier', 'liquidLite'], ['sidebarTier', 'sidebarLite']]) {
      if (['auto','full','move','lite'].includes(value[tier])) result[tier] = value[tier];
      if (result[lite] !== (result[tier] === 'lite')) result[tier] = result[lite] ? 'lite' : result[tier] === 'lite' ? 'auto' : result[tier];
      result[lite] = result[tier] === 'lite';
    }
    if (Array.isArray(value.navHidden)) result.navHidden = NAV.map(n => n[0]).filter(key => key !== 'more' && value.navHidden.includes(key));
    result.background = imageValue(value.background);
    if (typeof value.customCSS === 'string') result.customCSS = value.customCSS.slice(0, 50000);
    return result;
  }

  let settings;
  let storageError = '';
  try { settings = normalize(GM_getValue(KEY, DEFAULTS)); }
  catch { settings = normalize(DEFAULTS); storageError = '讀取 Tampermonkey storage 失敗，暫用預設值。'; }
  const validVolume=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0&&value<=1;
  let videoVolume=null,audioBalance=null,mediaDownloader=null;
  try { const value=GM_getValue(AUDIO_KEY,null);if(validVolume(value))videoVolume=value; }
  catch { storageError='讀取影片音量失敗，暫用播放器原始音量。'; }
  let syncMeta=loadSyncMeta(),syncConfig=loadSyncConfig(),syncMessage='';
  const knownVideos=new WeakSet(),videoWrites=new WeakMap(),videoGestures=new WeakMap();
  const root = document.documentElement;
  const initialBackground = getComputedStyle(document.body).backgroundColor;
  let navImage=null,navImageSource='';
  const style = document.createElement('style');
  style.id = 'xm-style';
  const customStyle = document.createElement('style');
  customStyle.id = 'xm-custom-style';
  const wallpaper = document.createElement('div');
  wallpaper.id = 'xm-wallpaper';
  wallpaper.setAttribute('aria-hidden', 'true');
  document.head.append(style, customStyle);
  document.body.prepend(wallpaper);

  const host = document.createElement('div');
  host.id = 'xm-settings';
  host.dataset.placement = 'menu';
  const shadow = host.attachShadow({mode:'open'});
  document.body.append(host);
  shadow.innerHTML = `
    <style>
      :host{font:14px/1.5 system-ui,sans-serif;color:var(--xm-text,#101214);color-scheme:var(--xm-scheme,light)}
      *{box-sizing:border-box}button,input,select,textarea{font:inherit}button,select,input[type=checkbox],input[type=range]{cursor:pointer}
      button{color:inherit}button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible{outline:2px solid var(--xm-text);outline-offset:3px}
      #launcher{display:flex;align-items:center;gap:14px;border:0;border-radius:24px;background:transparent;color:inherit;min-height:44px;padding:10px 12px;max-width:100%;white-space:nowrap}
      #launcher:hover{background:var(--xm-hover,#eee)}#launcher svg{width:24px;height:24px;flex:none}#launcher span{font-size:20px;line-height:24px}
      :host([data-placement=nav]){display:block;width:100%;align-self:stretch;flex-shrink:0}
      :host([data-placement=nav]) #launcher{color:var(--xm-nav-text,var(--xm-text));border-radius:12px}:host([data-placement=nav]) #launcher:hover{background:var(--xm-nav-hover,var(--xm-hover))}
      :host([data-placement=nav][data-labels=hidden]) #launcher-label,:host([data-placement=nav][data-labels=hover]:not([data-nav-expanded])) #launcher-label{display:none}
      :host([data-placement=nav]) #launcher{height:48px;min-height:48px;padding:12px 24px;gap:20px}:host([data-placement=nav][data-labels=hidden]) #launcher,:host([data-placement=nav][data-labels=hover]:not([data-nav-expanded])) #launcher{width:48px;max-width:48px;margin-inline:12px;justify-content:center;padding:12px}
      :host([data-placement=tabbar]){display:flex;flex:1 1 0;min-width:0;align-items:center;justify-content:center}
      :host([data-placement=tabbar]) #launcher{width:48px;height:48px;min-height:48px;padding:12px;justify-content:center;border-radius:999px}:host([data-placement=tabbar]) #launcher-label{display:none}
      :host([data-placement=menu]) #launcher{display:none}

      /* The settings dialog follows X's own settings modal: a category list on the left, one page at a time on the right. */
      dialog{width:min(1120px,calc(100vw - 32px));height:min(680px,calc(100dvh - 48px));max-width:none;max-height:none;margin:auto;padding:0;border:1px solid var(--xm-line,#ddd);border-radius:16px;background:var(--xm-panel,#fff);color:var(--xm-text,#111);overscroll-behavior:contain;font:15px/20px TwitterChirp,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,"Noto Sans TC","PingFang TC",sans-serif;--xm-accent:#1d9bf0}
      dialog[open]{display:flex;overflow:hidden}dialog::backdrop{background:rgb(0 0 0 / .45)}
      dialog[data-xm-ui-glass]{isolation:isolate;background:rgb(var(--xm-rgb) / max(.92,var(--xm-sidebar-opacity)));backdrop-filter:blur(var(--xm-sidebar-blur))}
      dialog[data-xm-ui-glass]:not([data-xm-glass-renderer="off"]){background:transparent;backdrop-filter:none}
      dialog[data-xm-ui-floating]{border-color:transparent}
      @media(forced-colors:active){dialog[data-xm-ui-glass]{background:Canvas}}
      small{display:block;font-size:13px;line-height:16px;color:var(--xm-muted)}
      .icon-button{width:36px;height:36px;display:grid;place-items:center;padding:0;border:0;border-radius:9999px;background:transparent}.icon-button:hover{background:var(--xm-hover)}.icon-button svg{width:20px;height:20px}
      #toc{width:320px;flex:none;display:flex;flex-direction:column;min-height:0;border-right:1px solid var(--xm-line)}
      #toc-header{display:none;height:56px;flex:none;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;padding:0 8px}#toc-header h1{grid-column:2;margin:0;text-align:center;font-size:17px;line-height:20px;font-weight:700}#toc-close{grid-column:3;justify-self:end}
      #search-box{display:flex;align-items:center;gap:10px;height:40px;flex:none;margin:16px 16px 8px;padding:0 14px;border:1px solid var(--xm-line);border-radius:9999px;color:var(--xm-muted);cursor:text}#search-box:focus-within{border-color:var(--xm-accent);box-shadow:0 0 0 1px var(--xm-accent)}#search-box svg{width:18px;height:18px;flex:none}
      #search{flex:1;min-width:0;height:100%;padding:0;border:0;background:transparent;color:var(--xm-text);font-size:15px}#search:focus-visible{outline:0}#search::placeholder{color:var(--xm-muted)}
      #toc-list{list-style:none;margin:0;padding:8px 8px 16px;flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;scrollbar-width:thin}
      #toc-list li[data-divider]::before{content:"";display:block;height:1px;margin:8px 12px;background:var(--xm-line)}
      #toc-list button{width:100%;height:48px;display:flex;align-items:center;gap:16px;padding:0 12px;border:0;border-radius:9999px;background:transparent;text-align:left;font-weight:500}#toc-list button:hover,#toc-list button[aria-current=page]{background:var(--xm-hover)}
      #toc-list svg{width:20px;height:20px;flex:none}#toc-list span{flex:1;min-width:0}#toc-list .chevron{display:none;width:18px;height:18px;color:var(--xm-muted)}
      #toc-footer{flex:none;padding:8px;border-top:1px solid var(--xm-line)}#status:empty{display:none}
      #panel{flex:1;min-width:0;min-height:0;display:flex;flex-direction:column}
      #panel>header{height:56px;flex:none;display:grid;grid-template-columns:52px minmax(0,1fr) 52px;align-items:center;padding:0 8px}#back{grid-column:1}#close{grid-column:3;justify-self:end}
      #panel-title{grid-column:2;margin:0;text-align:center;font-size:17px;line-height:20px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      form{flex:1;min-height:0;overflow:auto;overscroll-behavior:contain;padding:0 8px 32px;scrollbar-width:thin}
      section>h2{margin:0;padding:20px 12px 8px;font-size:13px;line-height:16px;font-weight:500;color:var(--xm-muted)}
      form:not([data-search]) section>h2,form:not([data-search]) section:not([data-current]),form[data-search] section[data-sub],form[data-search] section:not(:has([data-match])),form[data-search] :is(.description,.group-label){display:none!important}
      form[data-search] .fields>:not([data-match]):not(:has([data-match])){display:none!important}
      #search-empty{margin:0;padding:32px 12px;text-align:center;color:var(--xm-muted)}
      .description{margin:0;padding:4px 12px 12px;font-size:13px;line-height:16px;color:var(--xm-muted)}
      .fields{min-width:0;display:flex;flex-direction:column}
      .group-label,fieldset.choice>legend{margin:0;padding:20px 12px 8px;font-size:13px;line-height:16px;font-weight:500;color:var(--xm-muted)}.group-label{border-top:1px solid var(--xm-line)}
      fieldset.choice{min-width:0;margin:0;padding:0;border:0}fieldset.choice>legend{float:left;width:100%}fieldset.choice>legend+*{clear:both}
      .row,.option,.link-row{display:flex;gap:16px;align-items:center;min-height:48px;padding:12px;border-radius:12px;cursor:pointer}.row:hover,.option:hover,.link-row:hover{background:var(--xm-hover)}
      .row>span,.option>span,.link-row>span{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px}
      .row:has(input:disabled){cursor:default;opacity:.5}.row:has(input:disabled):hover{background:transparent}
      /* Motion Prompt #059 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#059 */
      .row input[type=checkbox]{appearance:none;position:relative;width:34px;height:20px;flex:0 0 34px;margin:0;border:0;border-radius:9999px;background:var(--xm-track,rgb(130 140 150 / .5));transition:background-color 200ms cubic-bezier(.333333,1,.666667,1)}
      .row input[type=checkbox]::before{content:"";position:absolute;left:2px;top:2px;width:16px;height:16px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0 / .25);transform:translateX(0);transition:transform 200ms cubic-bezier(.333333,1,.666667,1)}
      .row input[type=checkbox]:checked{background:var(--xm-accent)}.row input[type=checkbox]:checked::before{transform:translateX(14px)}
      @media(forced-colors:active){.row input[type=checkbox]{appearance:auto;width:18px;height:18px;flex-basis:18px;background:Canvas}.row input[type=checkbox]::before{content:none}}
      .option{position:relative}.option input{appearance:none;display:grid;place-items:center;width:20px;height:20px;flex:none;margin:0;border:2px solid var(--xm-muted);border-radius:50%;background:transparent}
      .option input::before{content:"";width:10px;height:10px;border-radius:50%;background:var(--xm-text);transform:scale(0);transition:transform 160ms cubic-bezier(.333333,1,.666667,1)}.option input:checked{border-color:var(--xm-text)}.option input:checked::before{transform:scale(1)}
      @media(forced-colors:active){.option input{appearance:auto}.option input::before{content:none}}
      .link-row{width:100%;border:0;background:transparent;text-align:left}.link-row .value{flex:none;font-size:13px;color:var(--xm-muted)}.link-row>svg{width:18px;height:18px;flex:none;color:var(--xm-muted)}
      .danger,.link-row.danger{color:var(--xm-error,#f4212e)}
      .field{display:flex;flex-direction:column;gap:6px;padding:8px 12px;font-size:13px;line-height:16px;color:var(--xm-muted)}
      input[type=url],input[type=text],input[type=password],textarea{width:100%;height:44px;padding:0 14px;border:1px solid var(--xm-line);border-radius:12px;background:transparent;color:var(--xm-text);font-size:15px;line-height:20px}
      input[type=url]:focus-visible,input[type=text]:focus-visible,input[type=password]:focus-visible,textarea:focus-visible{outline:0;border-color:var(--xm-accent);box-shadow:0 0 0 1px var(--xm-accent)}
      textarea{height:auto;min-height:140px;padding:12px 14px;resize:vertical;font:13px/18px ui-monospace,SFMono-Regular,Menlo,monospace}
      .url-row{display:flex;gap:8px;align-items:center}.url-row input{flex:1;min-width:0}
      .slider{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px 16px;padding:12px;font-size:15px;line-height:20px;color:var(--xm-text)}.slider .range{display:contents}
      .slider input{grid-column:1/-1;grid-row:2;width:100%;margin:0;accent-color:var(--xm-accent)}.slider output{grid-column:2;grid-row:1;color:var(--xm-muted);font-variant-numeric:tabular-nums}.slider:has(input:disabled){opacity:.5}
      .buttons{display:flex;gap:8px;flex-wrap:wrap;padding:8px 12px 12px}
      .action{height:36px;padding:0 16px;border:1px solid var(--xm-line);border-radius:9999px;background:transparent;font-weight:700;white-space:nowrap}.action:hover{background:var(--xm-hover)}.action:disabled{opacity:.5;cursor:default}
      .primary{background:var(--xm-text);border-color:var(--xm-text);color:var(--xm-panel)}.primary:hover{background:var(--xm-text);opacity:.88}
      .note{margin:0;padding:4px 12px 8px;font-size:13px;line-height:18px;color:var(--xm-muted);overflow-wrap:anywhere}.note:empty{display:none}
      #preview{height:168px;margin:0 12px 8px;border:1px solid var(--xm-line);border-radius:16px;background-size:cover;background-position:center;background-blend-mode:multiply;display:grid;place-items:center;overflow:hidden}
      #preview article{width:min(62%,420px);padding:12px 16px;border-radius:16px;color:var(--xm-text);background:var(--xm-panel)}#preview strong{font-weight:700}#preview p{margin:2px 0 0}
      #image-row{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:12px}#image-row>span:not(#image-thumb){flex:1;min-width:150px;display:flex;flex-direction:column;gap:2px}
      #image-thumb{width:100px;height:64px;flex:none;border:1px solid var(--xm-line);border-radius:12px;background:var(--xm-hover) center/cover no-repeat}
      #nav-options{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px 4px;padding:8px 12px 16px}
      .nav-choice{position:relative;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;cursor:pointer;color:var(--xm-muted);font-size:13px;line-height:16px;min-width:0}
      .nav-choice input{position:absolute;width:1px;height:1px;opacity:0}.nav-icon{display:grid;place-items:center;width:52px;height:52px;border:2px solid var(--xm-line);border-radius:50%}.nav-icon svg{width:24px;height:24px}
      .nav-choice:has(input:checked){color:var(--xm-text)}.nav-choice:has(input:checked) .nav-icon{border-color:var(--xm-accent)}.nav-choice:hover .nav-icon{background:var(--xm-hover)}.nav-choice:has(input:focus-visible) .nav-icon{outline:2px solid var(--xm-accent);outline-offset:3px}.nav-choice:has(input:disabled){cursor:default}
      #download-history{list-style:none;margin:0;padding:0}#download-history>li{display:flex;flex-direction:column;gap:4px;padding:12px;border-radius:12px;overflow-wrap:anywhere}#download-history>li:hover{background:var(--xm-hover)}#download-history a{color:inherit;font-weight:700;text-decoration:none}#download-history a:hover{text-decoration:underline}#download-history>li>span,#download-history details{font-size:13px;line-height:16px;color:var(--xm-muted)}
      #download-history .history-remove{align-self:flex-start;padding:2px 0;border:0;background:none;font-size:13px;color:var(--xm-muted);text-decoration:underline;text-underline-offset:2px}#download-history .history-remove:hover{color:var(--xm-text)}
      #css-pending{margin:8px 12px;padding:12px;border:1px solid var(--xm-error,#c93030);border-radius:12px}#css-pending .note{padding:0}#css-pending .buttons{padding:8px 0 0}#css-pending pre{max-height:200px;overflow:auto;margin:8px 0 0;padding:8px;border-radius:8px;background:var(--xm-hover);font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
      [hidden]{display:none!important}
      /* Narrow windows: X shows the category list first and opens each page full screen. */
      @media(max-width:640px){
        dialog{width:100vw;height:100dvh;border:0;border-radius:0}dialog[open]{flex-direction:column}
        #toc{width:100%;flex:1;border-right:0}#toc-header{display:grid}#search-box{margin-top:4px}
        #toc-list{padding:4px 0}#toc-list li[data-divider]::before{margin:8px 16px}#toc-list button{height:52px;padding:0 16px;border-radius:0}#toc-list button[aria-current=page]{background:transparent}#toc-list button:hover{background:var(--xm-hover)}#toc-list .chevron{display:block}
        #toc-footer{padding:8px 4px calc(8px + env(safe-area-inset-bottom))}
        dialog[data-view=list] #panel,dialog[data-view=detail] #toc{display:none}
        dialog[data-view=search] #toc{flex:none}dialog[data-view=search] :is(#toc-list,#toc-footer,#panel>header){display:none}
        #nav-options{grid-template-columns:repeat(4,minmax(0,1fr))}
      }
      /* Motion Prompt #049 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#049 */
      dialog::backdrop{background:rgb(18 20 28 / .42);animation:xm-scrim-in 320ms cubic-bezier(.333333,1,.666667,1) both}
      dialog[data-closing]::backdrop{animation:xm-scrim-out 280ms linear(0.000000,0.000122,0.000977,0.003296,0.007812,0.015259,0.026367,0.041870,0.062500,0.088989,0.122070,0.162476,0.210938,0.268188,0.334961,0.411987,0.500000,0.588013,0.665039,0.731812,0.789062,0.837524,0.877930,0.911011,0.937500,0.958130,0.973633,0.984741,0.992188,0.996704,0.999023,0.999878,1.000000) both}
      @keyframes xm-scrim-in{from{opacity:0}to{opacity:1}}@keyframes xm-scrim-out{from{opacity:1}to{opacity:0}}
      @media(prefers-reduced-motion:reduce){*,*::before,*::after{transition:none!important;animation:none!important}}
      @media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important}}
    </style>
    <button id="launcher" type="button" aria-label="X 極簡設定" title="X 極簡設定">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="var(--xm-nav-fill,var(--xm-panel,#fff))"/><circle cx="15" cy="17" r="3" fill="var(--xm-nav-fill,var(--xm-panel,#fff))"/></svg><span id="launcher-label">介面設定</span>
    </button>
    <dialog aria-labelledby="xm-title" data-view="detail">
      <nav id="toc" aria-label="設定分類">
        <header id="toc-header"><h1 id="xm-title">X 極簡設定</h1><button id="toc-close" class="icon-button" type="button" aria-label="關閉設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header>
        <label id="search-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M18 10.5a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0zM16 16l5 5"/></svg><input type="search" id="search" placeholder="搜尋設定" aria-label="搜尋設定" autocomplete="off" spellcheck="false"></label>
        <ul id="toc-list"></ul>
        <div id="toc-footer"><label class="row"><span><span>啟用 X 極簡</span><small id="status" role="status" aria-live="polite"></small></span><input type="checkbox" data-key="enabled"></label></div>
      </nav>
      <div id="panel">
        <header><button id="back" class="icon-button" type="button" aria-label="返回" hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12H4M10 6l-6 6 6 6"/></svg></button><h2 id="panel-title"></h2><button id="close" class="icon-button" type="button" aria-label="關閉設定"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 5l14 14M19 5 5 19"/></svg></button></header>
        <form method="dialog">
        <p id="search-empty" hidden></p>
        <section data-toc="背景與時間線" data-icon="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM21 16l-5-5-9 9M11 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z"><h2>背景與時間線</h2><p class="description">背景留在頁面兩側；中間可保留實色，或透出柔和的背景圖片。</p><div class="fields" id="appearance">
          <div id="preview" aria-label="時間線背景預覽"><article><strong>你的時間線</strong><p>保留清晰文字與原始媒體。</p></article></div>
          <h3 class="group-label">背景圖片</h3>
          <div id="image-row"><span id="image-thumb" aria-hidden="true"></span><span><span id="image-state"></span><small>本機圖片上限 6 MiB，與設定一起存在 Tampermonkey storage</small></span><button type="button" class="action" id="pick-image">選擇本機圖片</button><button type="button" class="action danger" id="clear-image">移除</button></div>
          <label class="field">或使用圖片網址<span class="url-row"><input type="url" id="image-url" placeholder="https://…" autocomplete="off"><button type="button" class="action" id="apply-url">套用</button></span></label>
          <input type="file" id="image-file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" hidden>
          <p class="note">使用網址時，瀏覽器會向圖片網站載入圖片。</p>
          <fieldset class="choice"><legend>背景排列</legend><label class="option"><span>填滿畫面</span><input type="radio" name="backgroundFit" data-key="backgroundFit" value="cover"></label><label class="option"><span>完整顯示</span><input type="radio" name="backgroundFit" data-key="backgroundFit" value="contain"></label><label class="option"><span>原尺寸平鋪</span><input type="radio" name="backgroundFit" data-key="backgroundFit" value="repeat"></label></fieldset>
          <fieldset class="choice"><legend>背景位置</legend><label class="option"><span>置中</span><input type="radio" name="backgroundPosition" data-key="backgroundPosition" value="center"></label><label class="option"><span>靠上</span><input type="radio" name="backgroundPosition" data-key="backgroundPosition" value="top"></label><label class="option"><span>靠下</span><input type="radio" name="backgroundPosition" data-key="backgroundPosition" value="bottom"></label></fieldset>
          <label class="field slider">背景壓暗<span class="range"><input type="range" data-key="backgroundDim" min="0" max="80" step="1"><output></output></span></label>
          <h3 class="group-label">時間線</h3>
          <fieldset class="choice"><legend>時間線背景</legend><label class="option"><span>保留實色背景</span><input type="radio" name="timelineMode" data-key="timelineMode" value="solid"></label><label class="option"><span>高斯模糊／毛玻璃</span><input type="radio" name="timelineMode" data-key="timelineMode" value="glass"></label><label class="option"><span><span>Liquid Glass</span><small>與導覽相同的折射效果</small></span><input type="radio" name="timelineMode" data-key="timelineMode" value="liquid"></label></fieldset>
          <div class="fields" id="liquid-options" hidden><fieldset class="choice" aria-describedby="liquid-state"><legend>效能</legend><label class="option"><span><span>自動</span><small>不夠流暢時依序降到第一層、第二層</small></span><input type="radio" name="liquidTier" data-key="liquidTier" value="auto"></label><label class="option"><span><span>永不降級</span><small>一律完整折射，捲動時也照常繪製</small></span><input type="radio" name="liquidTier" data-key="liquidTier" value="full"></label><label class="option"><span><span>第一層</span><small>玻璃移動時暫時隱藏折射邊，停下後恢復</small></span><input type="radio" name="liquidTier" data-key="liquidTier" value="move"></label><label class="option"><span><span>第二層</span><small>停用折射，只保留模糊</small></span><input type="radio" name="liquidTier" data-key="liquidTier" value="lite"></label></fieldset><p class="note" id="liquid-state" role="status"></p></div>
          <label class="field slider" data-glass>毛玻璃不透明度<span class="range"><input type="range" data-key="opacity" min="15" max="100" step="1"><output></output></span></label>
          <label class="field slider" data-glass>高斯模糊強度<span class="range"><input type="range" data-key="blur" min="0" max="60" step="1"><output></output></span></label>
          <label class="field slider">時間線寬度<span class="range"><input type="range" data-key="width" min="480" max="1100" step="10"><output></output></span></label>
          <p class="note">兩側導覽與推薦欄的效果在「顯示效果」獨立設定。</p>
        </div></section>
        <section data-toc="顯示效果" data-icon="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16v5M16.5 18.5h5"><h2>顯示效果</h2><p class="description">導覽、分頁與浮窗獨立於時間線，使用同款 Liquid Glass 折射。</p><div class="fields" id="effects">
          <fieldset class="choice"><legend>側欄、分頁與浮窗背景</legend><label class="option"><span><span>Liquid Glass</span><small>同款折射</small></span><input type="radio" name="sidebarMode" data-key="sidebarMode" value="liquid"></label><label class="option"><span>高斯模糊／毛玻璃</span><input type="radio" name="sidebarMode" data-key="sidebarMode" value="glass"></label><label class="option"><span>實色背景</span><input type="radio" name="sidebarMode" data-key="sidebarMode" value="solid"></label></fieldset>
          <div class="fields" id="sidebar-liquid-options"><fieldset class="choice" aria-describedby="sidebar-liquid-state"><legend>效能</legend><label class="option"><span><span>自動</span><small>不夠流暢時依序降到第一層、第二層</small></span><input type="radio" name="sidebarTier" data-key="sidebarTier" value="auto"></label><label class="option"><span><span>永不降級</span><small>一律完整折射，捲動時也照常繪製</small></span><input type="radio" name="sidebarTier" data-key="sidebarTier" value="full"></label><label class="option"><span><span>第一層</span><small>玻璃移動時暫時隱藏折射邊，停下後恢復</small></span><input type="radio" name="sidebarTier" data-key="sidebarTier" value="move"></label><label class="option"><span><span>第二層</span><small>停用折射，只保留模糊</small></span><input type="radio" name="sidebarTier" data-key="sidebarTier" value="lite"></label></fieldset><p class="note" id="sidebar-liquid-state" role="status"></p></div>
          <label class="field slider" data-sidebar-glass>介面不透明度<span class="range"><input type="range" data-key="sidebarOpacity" min="15" max="100" step="1"><output></output></span></label>
          <label class="field slider" data-sidebar-glass>介面模糊強度<span class="range"><input type="range" data-key="sidebarBlur" min="0" max="60" step="1"><output></output></span></label>
          <h3 class="group-label">游標</h3>
          <label class="row"><span><span>磁吸與文字游標</span><small>游標吸附連結與按鈕，移到文字時切換為文字光標。觸控裝置或系統要求減少動態效果時，保留原生游標。</small></span><input type="checkbox" data-key="magneticCursor"></label>
        </div></section>
        <section data-toc="版面與行為" data-icon="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4v16M9 10h12"><h2>版面與行為</h2><p class="description">新舊版介面自動辨識。時間線置中會在空間足夠時對齊視窗中央；窄視窗優先保留閱讀寬度。</p><div class="fields" id="reading">
          <fieldset class="choice"><legend>透明時間線的文字配色</legend><label class="option"><span>依背景自動調整</span><input type="radio" name="readingTextTone" data-key="readingTextTone" value="auto"></label><label class="option"><span>淺色文字</span><input type="radio" name="readingTextTone" data-key="readingTextTone" value="light"></label><label class="option"><span>深色文字</span><input type="radio" name="readingTextTone" data-key="readingTextTone" value="dark"></label></fieldset>
          <h3 class="group-label">版面</h3><div class="fields" id="reading-layout"></div>
          <h3 class="group-label">行為</h3><div class="fields" id="reading-behavior"></div>
        </div></section>
        <section data-toc="隱藏介面元素" data-icon="M3 3l18 18M10.6 6.1A9.8 9.8 0 0 1 12 6c5 0 9 6 9 6a17 17 0 0 1-2.6 3.2M6.6 6.6C4.3 8.1 3 12 3 12s4 6 9 6a9 9 0 0 0 3.4-.7M9.9 9.9a3 3 0 0 0 4.2 4.2"><h2>隱藏介面元素</h2><p class="description">移除廣告、推薦和不常用的入口。關閉開關即恢復 X 原本的顯示。</p><div class="fields" id="hiding">
          <h3 class="group-label">時間線</h3><div class="fields" id="hiding-timeline"></div>
          <h3 class="group-label">側欄</h3><div class="fields" id="hiding-side"></div>
          <h3 class="group-label">浮窗與其他</h3><div class="fields" id="hiding-other"></div>
        </div></section>
        <section data-toc="貼文計數" data-icon="M5 20V10M12 20V4M19 20v-7"><h2>貼文計數</h2><p class="description">隱藏數字時，保留按讚、回覆與轉發操作。</p><div class="fields" id="posts"></div></section>
        <section data-toc="媒體下載與分享" data-icon="M12 3v12M7 10l5 5 5-5M4 20h16"><h2>媒體下載與分享</h2><p class="description">一般點擊略過已下載的媒體；按住 Shift 再點可重新下載全部。</p><div class="fields" id="media">
          <div class="fields" id="media-download"></div>
          <h3 class="group-label">分享選單</h3><div class="fields" id="media-share"></div>
          <h3 class="group-label">紀錄</h3>
          <button type="button" class="link-row" id="history-open"><span><span>下載紀錄</span><small>成功下載後保留，用來略過重複的媒體</small></span><span class="value" id="history-count"></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
        </div></section>
        <section id="history-page" data-sub data-toc="下載紀錄"><h2>下載紀錄</h2><p class="description" id="download-summary" role="status"></p><div class="fields">
          <ol id="download-history"></ol>
          <div class="buttons"><button type="button" class="action" id="history-more" hidden>顯示更多</button></div>
          <button type="button" class="link-row danger" id="history-clear" hidden><span><span>清空下載紀錄</span><small>已下載的檔案不受影響，之後再按下載會重新下載</small></span></button>
        </div></section>
        <section id="audio-section" data-toc="影片音量" data-icon="M4 9h4l5-4v14l-5-4H4zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"><h2>影片音量</h2><p class="description">沿用你的音量曲線與平衡算法。首頁自動播放保留 X 的靜音設定。</p><div class="fields">
          <label class="row"><span><span>記憶影片音量</span><small>播放器調整的音量會套用到後續影片</small></span><input type="checkbox" data-key="rememberVideoVolume"></label>
          <label class="field slider">記憶音量<span class="range"><input id="video-volume" type="range" min="0" max="100" step="0.1"><output></output></span></label>
          <label class="row"><span><span>音量平衡</span><small>減少影片之間的大小聲差異，音訊在本機處理</small></span><input type="checkbox" data-key="balanceVideoAudio"></label>
          <p class="note" id="audio-state" role="status">播放影片後啟用音量平衡。</p>
          <p class="note">音量會存進 Tampermonkey。滑桿採三次方曲線，低音量更容易微調；50% 對應 12.5% 原始增益。</p>
        </div></section>
        <section data-toc="側邊導覽" data-icon="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM9 4v16M5.5 8h1M5.5 11h1M5.5 14h1"><h2>側邊導覽</h2><p class="description">點圖示切換顯示，藍色外圈表示顯示。「更多」一直保留，X 極簡的設定入口在它的選單裡。</p><div class="fields">
          <div id="nav-options" role="group" aria-label="顯示於側邊導覽的項目"></div>
          <fieldset class="choice"><legend>導覽文字</legend><label class="option"><span>持續顯示</span><input type="radio" name="navLabels" data-key="navLabels" value="always"></label><label class="option"><span><span>停留後展開</span><small>鍵盤聚焦時也會顯示</small></span><input type="radio" name="navLabels" data-key="navLabels" value="hover"></label><label class="option"><span>只顯示圖示</span><input type="radio" name="navLabels" data-key="navLabels" value="hidden"></label></fieldset>
          <h3 class="group-label">其他</h3><div class="fields" id="navigation"></div>
        </div></section>
        <section data-toc="跨裝置同步" data-divider data-icon="M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9zM12 16v-5M9.5 13.5 12 11l2.5 2.5"><h2>跨裝置同步</h2><p class="description">同步外觀、背景、音量與下載紀錄。連線密鑰只保存在此裝置。</p><div class="fields">
          <fieldset class="choice"><legend>同步服務</legend><label class="option"><span><span>Google Drive</span><small>使用配套 Apps Script</small></span><input type="radio" name="sync-provider" value="drive"></label><label class="option"><span><span>WebDAV</span><small>使用既有的同步檔案網址</small></span><input type="radio" name="sync-provider" value="webdav"></label></fieldset>
          <h3 class="group-label">連線</h3>
          <p class="note" id="sync-connection"></p>
          <label class="field"><span id="sync-url-label">Apps Script 的 /exec 網址</span><input type="url" id="sync-url" placeholder="https://…" autocomplete="off" spellcheck="false"></label>
          <label class="field" data-sync-provider="drive">同步密鑰<input type="password" id="sync-key" autocomplete="off" spellcheck="false"></label>
          <label class="field" data-sync-provider="webdav">使用者名稱<input type="text" id="sync-user" autocomplete="off" spellcheck="false"></label>
          <label class="field" data-sync-provider="webdav">應用程式密碼<input type="password" id="sync-password" autocomplete="new-password" spellcheck="false"></label>
          <div class="buttons"><button type="button" class="action primary" id="sync-now">立即同步</button><button type="button" class="action" id="sync-test">測試連線</button><button type="button" class="action" id="sync-save">儲存連線</button></div>
          <p class="note" id="sync-state" role="status" aria-live="polite"></p>
          <label class="row"><span><span>自動同步</span><small>開頁、變更後與每分鐘</small></span><input type="checkbox" id="sync-auto"></label>
          <p class="note">啟用後會將上述資料傳送至你設定的服務；X 分頁關閉時停止同步。修改連線或切換服務會先關閉自動同步。來自其他裝置的自訂 CSS 需要你確認後才會套用。</p>
        </div></section>
        <section data-toc="進階與備份" data-icon="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"><h2>進階與備份</h2><p class="description">匯出的檔案包含本機背景圖，可在其他電腦匯入。</p><div class="fields">
          <label class="field">自訂 CSS<textarea data-key="customCSS" spellcheck="false"></textarea></label>
          <div class="fields" id="css-pending" hidden><p class="note" id="css-pending-state" role="status"></p><details><summary>查看雲端的自訂 CSS</summary><pre id="css-pending-text"></pre></details><div class="buttons"><button type="button" class="action" id="css-accept">套用雲端 CSS</button><button type="button" class="action" id="css-keep">保留本機 CSS</button></div></div>
          <h3 class="group-label">備份</h3>
          <button type="button" class="link-row" id="export"><span><span>匯出設定</span><small>下載包含背景、音量與下載紀錄的 JSON 檔</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
          <button type="button" class="link-row" id="import"><span><span>匯入設定</span><small>從 X 極簡匯出的 JSON 檔還原</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg></button>
          <button type="button" class="link-row danger" id="reset"><span><span>恢復預設</span><small>清除設定、背景與影片音量；下載紀錄與同步連線保留</small></span></button>
          <input type="file" id="import-file" accept="application/json,.json" hidden>
        </div></section>
        </form>
      </div>
    </dialog>`;

  const dialog = shadow.querySelector('dialog');
  const $ = selector => shadow.querySelector(selector);
  function toggles(target, entries) {
    const rows=[];
    for (const [key, title, detail] of entries) {
      const label = document.createElement('label');
      label.className = 'row';
      const text = document.createElement('span'),name = document.createElement('span');
      name.textContent = title;text.append(name);
      if(detail){const small=document.createElement('small');small.textContent=detail;text.append(small);}
      const input = document.createElement('input');
      input.type = 'checkbox'; input.dataset.key = key;
      label.append(text, input); rows.push(label);
    }
    $(target).append(...rows);
  }
  toggles('#reading-layout', [
    ['centerTimeline','時間線水平置中'],['navAlignLeft','左側導覽靠齊視窗左緣'],['rightAlignSidebar','右側推薦欄靠齊視窗右緣'],
    ['removeBorders','隱藏時間線兩側框線'],['removePostBorders','隱藏貼文分隔線'],['stickyHeader','固定頂部標頭'],
    ['transparentSearch','透明搜尋列'],['systemFont','使用系統字體']
  ]);
  toggles('#reading-behavior', [['defaultFollowing','進入首頁時選擇「正在跟隨」'],['zen','專注寫作模式','只保留發文框']]);
  toggles('#hiding-timeline', [['hideAds','隱藏廣告貼文'],['hideSuggestions','隱藏推薦追蹤與主題'],['hideTopTabs','隱藏首頁時間線分頁'],['hideComposer','隱藏首頁發文框']]);
  toggles('#hiding-side', [['hideSidebar','隱藏右側趨勢與推薦欄'],['hideSearch','隱藏右欄搜尋列'],['hidePremiumUpsell','隱藏 Subscribe to Premium'],['hidePostButton','隱藏側邊發文按鈕']]);
  toggles('#hiding-other', [['hideGrok','隱藏 Grok','浮窗與貼文上的 AI 按鈕'],['hideChatDrawer','隱藏右下角聊天浮窗','含按鈕'],['hideTitleCount','隱藏分頁標題的未讀數']]);
  toggles('#posts', [
    ['hideViewCount','隱藏瀏覽次數'],['hideReplyCount','隱藏回覆數'],['hideRepostCount','隱藏轉發數'],['hideLikeCount','隱藏喜歡數'],['hideFollowCount','隱藏追蹤與粉絲數']
  ]);
  toggles('#media-download', [['mediaDownloadEnabled','在貼文操作列顯示下載按鈕']]);
  toggles('#media-share', [['fixupCopy','加入「複製 FixupX 連結」'],['hideNativeCopyLink','隱藏原本的「複製連結」']]);
  toggles('#navigation', [['centerNav','垂直置中導覽'],['hideLogo','隱藏 X 標誌'],['hideUnread','隱藏導覽未讀徽章']]);
  for (const [key, title] of NAV) {
    const label = document.createElement('label'); label.className = 'nav-choice';
    const text = document.createElement('span'); text.textContent = title;
    const input = document.createElement('input'); input.type='checkbox'; input.dataset.nav = key;
    input.setAttribute('aria-label',`顯示${title}`);
    // The settings entry lives in the More menu, so More itself can never be hidden.
    if(key==='more'){input.disabled=true;label.title='X 極簡的設定入口在「更多」選單裡，所以一直顯示';}
    const icon = document.createElement('span');icon.className='nav-icon';
    icon.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[key]}</svg>`;
    label.append(input,icon,text); $('#nav-options').append(label);
  }
  // One page at a time, like X's settings: the list picks a page, search shows matching rows from every page.
  const tocSections=[...shadow.querySelectorAll('section[data-toc]:not([data-sub])')];
  const narrowSettings=matchMedia('(max-width:640px)');
  let currentSection=tocSections[0],subSection=null,settingsView='detail';
  const tocButtons=tocSections.map(section=>{
    const item=document.createElement('li'),button=document.createElement('button');
    if(section.hasAttribute('data-divider'))item.dataset.divider='';
    button.type='button';
    button.innerHTML=`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${section.dataset.icon}"/></svg><span></span><svg class="chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 6 6 6-6 6"/></svg>`;
    button.querySelector('span').textContent=section.dataset.toc;
    button.addEventListener('click',()=>showSection(section));
    item.append(button);$('#toc-list').append(item);return button;
  });
  function renderPanel(){
    const raw=$('#search').value.trim(),query=raw.toLowerCase(),form=$('form');
    form.toggleAttribute('data-search',!!query);
    for(const item of form.querySelectorAll('[data-match]'))item.removeAttribute('data-match');
    let matches=0;
    if(query)for(const item of form.querySelectorAll('section:not([data-sub]) :is(.row,.field,fieldset.choice,.link-row,#nav-options,#image-row)')){
      if(item.closest('[hidden]')||!item.textContent.toLowerCase().includes(query))continue;
      item.setAttribute('data-match','');matches++;
    }
    $('#search-empty').hidden=!query||matches>0;
    $('#search-empty').textContent=`找不到符合「${raw}」的設定。`;
    const shown=subSection||currentSection;
    for(const section of form.querySelectorAll('section'))section.toggleAttribute('data-current',section===shown);
    tocButtons.forEach((button,i)=>button.setAttribute('aria-current',!query&&tocSections[i]===currentSection?'page':'false'));
    $('#panel-title').textContent=query?'搜尋結果':shown.dataset.toc;
    dialog.dataset.view=query?'search':settingsView;
    $('#back').hidden=!!query||!(subSection||narrowSettings.matches);
  }
  function showSection(section){
    currentSection=section;subSection=null;settingsView='detail';
    if($('#search').value){$('#search').value='';}
    renderPanel();$('form').scrollTop=0;
    if(narrowSettings.matches)$('#back').focus();
  }
  function showSubSection(section,from){
    // Opening a sub-page from search results leaves search and lands in that page's category.
    if($('#search').value){$('#search').value='';currentSection=tocSections.find(page=>page.contains(from))||currentSection;settingsView='detail';}
    subSection=section;subSection.returnFocus=from;renderPanel();$('form').scrollTop=0;$('#back').focus();
  }
  $('#back').addEventListener('click',()=>{
    if(subSection){const focus=subSection.returnFocus;subSection=null;renderPanel();focus?.focus();return;}
    settingsView='list';renderPanel();tocButtons[tocSections.indexOf(currentSection)]?.focus();
  });
  $('#history-open').addEventListener('click',event=>showSubSection($('#history-page'),event.currentTarget));
  $('#search').addEventListener('input',()=>{renderPanel();$('form').scrollTop=0;});
  narrowSettings.addEventListener?.('change',renderPanel);
  renderPanel();

  function status(message, error=false) {
    $('#status').textContent = message;
    $('#status').style.color = error ? 'var(--xm-error,#c93030)' : '';
  }
  function syncUI() {
    for (const input of shadow.querySelectorAll('[data-key]')) {
      const value = settings[input.dataset.key];
      if (input.type === 'checkbox') input.checked = value;
      else if (input.type === 'radio') input.checked = String(value) === input.value;
      else if (input !== shadow.activeElement) input.value = value;
      if (input.type === 'range') input.nextElementSibling.textContent = `${value}${['blur','sidebarBlur','width'].includes(input.dataset.key) ? ' px' : '%'}`;
    }
    for (const input of shadow.querySelectorAll('[data-nav]')) input.checked = !settings.navHidden.includes(input.dataset.nav);
    syncVideoVolume();syncDownloadHistoryUI();syncConnectionUI();
    if ($('#image-url') !== shadow.activeElement) $('#image-url').value = settings.background.startsWith('https:') ? settings.background : '';
    $('#image-state').textContent = !settings.background ? '目前未設定背景圖片' : settings.background.startsWith('data:') ? '已儲存本機背景圖片' : '已設定網址背景圖片';
    const glass = settings.timelineMode === 'glass' || !!settings.background;
    for (const row of shadow.querySelectorAll('[data-glass]')) row.hidden = !glass;
    $('#image-thumb').style.backgroundImage = settings.background ? `url(${JSON.stringify(settings.background)})` : 'none';
    $('#clear-image').disabled = !settings.background;
    const preview = $('#preview');
    preview.style.backgroundImage = settings.background ? `url(${JSON.stringify(settings.background)})` : 'none';
    const shade=Math.round(255*(1-settings.backgroundDim/100));
    preview.style.backgroundColor = settings.background ? `rgb(${shade} ${shade} ${shade})` : 'var(--xm-hover)';
    $('#liquid-options').hidden=settings.timelineMode!=='liquid';
    $('#sidebar-liquid-options').hidden=settings.sidebarMode!=='liquid';
    for(const row of shadow.querySelectorAll('[data-sidebar-glass]'))row.hidden=settings.sidebarMode==='solid';
    $('[data-key="hideNativeCopyLink"]').disabled=!settings.fixupCopy;
    syncPendingCSSUI();
    const timelineGlass=settings.timelineMode!=='solid';
    preview.querySelector('article').style.cssText = `background:rgb(var(--xm-rgb) / ${timelineGlass ? settings.opacity/100 : 1});backdrop-filter:blur(${timelineGlass ? settings.blur : 0}px);-webkit-backdrop-filter:blur(${timelineGlass ? settings.blur : 0}px)`;
    renderPanel();
  }
  function commit(next,retryEffect='',track=true) {
    const clean = normalize(next);
    try { GM_setValue(KEY, clean); }
    catch (error) { status(`儲存失敗：${error.message || '請檢查 Tampermonkey storage 可用空間。'}`, true); syncUI(); return false; }
    if(track)markSyncFields(settings,clean);
    const resetLiquid=retryEffect==='timeline'||clean.liquidTier!==settings.liquidTier||(clean.timelineMode==='liquid'&&settings.timelineMode!=='liquid');
    const resetSidebar=retryEffect==='sidebar'||clean.sidebarTier!==settings.sidebarTier||(clean.sidebarMode==='liquid'&&settings.sidebarMode!=='liquid');
    settings = clean; storageError = '';if(resetLiquid)liquid?.resetPerformance();if(resetSidebar){for(const effect of sidebarLiquids)effect.controller.resetPerformance();for(const record of interfaceGlass.values())record.controller.resetPerformance();}apply(); refresh(); updateVideoAudio();syncUI();if(track)syncController?.changed();status('已儲存至 Tampermonkey');return true;
  }
  // Motion Prompt #049 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#049
  // Motion Prompt #049-072 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#049
  let settingsAnimation=null;
  function animateSettings(open){
    settingsAnimation?.cancel();dialog.toggleAttribute('data-closing',!open);
    if(typeof dialog.animate!=='function'||typeof matchMedia!=='function'||matchMedia('(prefers-reduced-motion: reduce)').matches){if(!open)dialog.close();updateInterfaceGlass();return;}
    const frames=Array.from({length:33},(_,i)=>{const t=i/32,out=1-(1-t)**3,inside=t<.5?4*t**3:1-(-2*t+2)**3/2,a=open?out:1-inside;return {offset:t,opacity:a,transform:`scale(${.9+.1*a})`};});
    const animation=dialog.animate(frames,{duration:open?320:280,easing:'linear'});settingsAnimation=animation;
    animation.finished.then(()=>{if(settingsAnimation===animation){settingsAnimation=null;if(!open){dialog.close();dialog.removeAttribute('data-closing');}updateInterfaceGlass();}}).catch(()=>{});
  }
  function closeSettings(){if(dialog.open&&!dialog.hasAttribute('data-closing'))animateSettings(false);}
  function openSettings() { if (!dialog.open){subSection=null;settingsView=narrowSettings.matches?'list':'detail';} syncUI(); if (!dialog.open){dialog.showModal();animateSettings(true);updateInterfaceGlass();} status(storageError || '變更會立即儲存。', !!storageError); }
  $('#launcher').addEventListener('click', openSettings);
  for (const id of ['close','toc-close']) $(`#${id}`).addEventListener('click', closeSettings);
  dialog.addEventListener('click', event => { if (event.target === dialog) { const r=dialog.getBoundingClientRect(); if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom) closeSettings(); } });
  dialog.addEventListener('cancel',event=>{event.preventDefault();closeSettings();});
  shadow.querySelector('form').addEventListener('submit', event => event.preventDefault());
  shadow.addEventListener('change', event => {
    const input = event.target;
    if (input.dataset.key) commit({...settings,[input.dataset.key]:input.type==='checkbox'?input.checked:input.type==='range'?Number(input.value):input.value,...input.dataset.key==='liquidTier'?{liquidLite:input.value==='lite'}:input.dataset.key==='sidebarTier'?{sidebarLite:input.value==='lite'}:{}});
    if (input.dataset.nav) commit({...settings,navHidden:[...shadow.querySelectorAll('[data-nav]:not(:checked)')].map(i=>i.dataset.nav)});
  });
  shadow.addEventListener('input', event => {
    if (event.target.type === 'range') {
      const input=event.target, value=Number(input.value);
      input.nextElementSibling.textContent=`${value}${['blur','sidebarBlur','width'].includes(input.dataset.key)?' px':'%'}`;
    }
  });
  function syncVideoVolume(force=false){
    const input=$('#video-volume'),percent=Math.cbrt(videoVolume??document.querySelector('video')?.volume??1)*100;
    if(force||input!==shadow.activeElement)input.value=percent;
    input.disabled=!settings.enabled||!settings.rememberVideoVolume;
    input.nextElementSibling.textContent=`${Number(percent.toFixed(1))}%`;
  }
  function restoreVideoVolume(video){
    if(!settings.enabled||!settings.rememberVideoVolume||videoVolume===null||video.volume===videoVolume)return;
    videoWrites.set(video,videoVolume);video.volume=videoVolume;
  }
  function saveVideoVolume(value,track=true){
    if(value!==null&&!validVolume(value))return false;
    try { GM_setValue(AUDIO_KEY,value); }
    catch(error){status(`影片音量儲存失敗：${error.message||'請檢查 Tampermonkey storage。'}`,true);syncVideoVolume(true);return false;}
    if(track)markSyncFields({videoVolume},{videoVolume:value});
    videoVolume=value;if(track)syncController?.changed();
    for(const video of document.querySelectorAll('video'))restoreVideoVolume(video);
    syncVideoVolume();return true;
  }
  function scanVideos(){
    for(const video of document.querySelectorAll('video')){
      mark(video.closest('[data-testid="videoPlayer"],[data-testid="videoComponent"]')||video.parentElement,'video-frame');
      audioBalance?.attach(video);
      if(knownVideos.has(video))continue;
      knownVideos.add(video);restoreVideoVolume(video);
      for(const name of ['loadedmetadata','emptied','play'])video.addEventListener(name,()=>{
        if(name!=='play')videoGestures.delete(video);
        restoreVideoVolume(video);
      });
      video.addEventListener('volumechange',()=>{
        if(!settings.enabled||!settings.rememberVideoVolume)return;
        if(videoWrites.get(video)===video.volume)return;
        videoWrites.delete(video);
        if(Date.now()-Math.max(videoGestures.get(video)||0,volumeGesture)<2000){
          if(!saveVideoVolume(video.volume))restoreVideoVolume(video);
        }else restoreVideoVolume(video);
      });
    }
    audioBalance?.update();
  }
  function updateVideoAudio(){
    for(const video of document.querySelectorAll('video'))restoreVideoVolume(video);
    audioBalance?.update();
  }
  // X can render its volume slider in a deep tree or a separate popup outside the player.
  let draggingVideos=[],draggingVolume=false,volumeGesture=0;
  function isVolumeControl(element){
    if(!element.matches('[role="slider"],input[type="range"],[data-testid*="volume" i]'))return false;
    const labelled=(element.getAttribute('aria-labelledby')||'').split(/\s+/).map(id=>document.getElementById(id)?.textContent||'').join(' ');
    return /volume|音量|ボリューム|볼륨/i.test([element.getAttribute('aria-label'),element.title,element.id,element.getAttribute('data-testid'),labelled].join(' '));
  }
  for(const name of ['pointerdown','keydown','wheel'])document.addEventListener(name,event=>{
    if(!event.isTrusted)return;
    if(name!=='wheel'&&document.querySelector('video'))audioBalance?.resume();
    const path=event.composedPath().filter(element=>element instanceof Element);
    if(path.includes(host))return;
    if(name==='pointerdown'){draggingVideos=[];draggingVolume=false;}
    if(path.some(isVolumeControl)){
      volumeGesture=Date.now();if(name==='pointerdown')draggingVolume=true;return;
    }
    if(path.some(element=>element.matches('[role="slider"],input[type="range"]')))return;
    for(const target of path){
      if(target.matches('main,body,html'))break;
      const videos=target.matches('video')?[target]:[...target.querySelectorAll('video')];
      if(videos.length){for(const video of videos)videoGestures.set(video,Date.now());if(name==='pointerdown')draggingVideos=videos;break;}
      if(target.matches('article'))break;
    }
  },{capture:true,passive:true});
  document.addEventListener('pointermove',event=>{
    if(event.isTrusted&&event.buttons){if(draggingVolume)volumeGesture=Date.now();for(const video of draggingVideos)videoGestures.set(video,Date.now());}
  },{capture:true,passive:true});
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,event=>{
    if(event.isTrusted){if(draggingVolume)volumeGesture=Date.now();for(const video of draggingVideos)videoGestures.set(video,Date.now());draggingVideos=[];draggingVolume=false;}
  },{capture:true,passive:true});
  $('#video-volume').addEventListener('input',event=>{
    if(saveVideoVolume((Number(event.target.value)/100)**3))status('影片音量已儲存至 Tampermonkey');
  });
  let imageRequest = 0;
  async function setImage(value) {
    const request = ++imageRequest;
    const valid = imageValue(value.trim());
    if (value && !valid) { status('請使用 HTTPS 圖片網址，或選擇 PNG、JPEG、WebP、GIF、AVIF 圖片。',true); return; }
    if (!valid) { commit({...settings,background:''}); return; }
    status('正在載入圖片…');
    try {
      await new Promise((resolve,reject) => {
        const image = new Image();
        image.referrerPolicy='no-referrer';
        const timeout=setTimeout(()=>{image.src='';reject(new Error('圖片載入逾時，請檢查網址與連線。'));},15000);
        image.onload=()=>{clearTimeout(timeout);resolve();};
        image.onerror=()=>{clearTimeout(timeout);reject(new Error('圖片載入失敗，請確認網址可直接顯示圖片。'));};
        image.src=valid;
      });
      if(request===imageRequest) commit({...settings,background:valid});
    } catch(error) { if(request===imageRequest) status(error.message,true); }
  }
  $('#apply-url').addEventListener('click',()=>setImage($('#image-url').value));
  $('#image-url').addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();setImage(event.target.value);}});
  $('#pick-image').addEventListener('click',()=>$('#image-file').click());
  $('#clear-image').addEventListener('click',()=>{imageRequest++;commit({...settings,background:''});});
  $('#image-file').addEventListener('change',async event=>{
    const file=event.target.files[0]; event.target.value=''; if(!file)return;
    if(!/^image\/(png|jpeg|webp|gif|avif)$/.test(file.type)||file.size>MAX_IMAGE){status('請選擇 6 MiB 以下的 PNG、JPEG、WebP、GIF 或 AVIF 圖片。',true);return;}
    try { const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('讀取圖片失敗。'));reader.readAsDataURL(file);});await setImage(data); }
    catch(error){status(error.message,true);}
  });
  $('#history-more').addEventListener('click',()=>{historyLimit+=50;syncDownloadHistoryUI();});
  $('#export').addEventListener('click',()=>{
    const blob=new Blob([JSON.stringify({format:'x-minimal',version:1,settings,videoVolume,downloadHistory},null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='x-minimal-settings.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);status('已匯出設定、背景與下載紀錄。');
  });
  $('#import').addEventListener('click',()=>$('#import-file').click());
  $('#import-file').addEventListener('change',async event=>{
    const file=event.target.files[0];event.target.value='';if(!file)return;
    try {
      if(file.size>MAX_BACKUP)throw new Error('設定檔過大，請使用 X 極簡匯出的 JSON。');
      const data=JSON.parse(await file.text());
      if(data.format!=='x-minimal'||data.version!==1||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw new Error('設定檔格式錯誤，請使用 X 極簡匯出的 JSON。');
      if(data.settings.background&&!imageValue(data.settings.background))throw new Error('設定檔的背景圖片格式無效。');
      if(data.videoVolume!==undefined&&data.videoVolume!==null&&!validVolume(data.videoVolume))throw new Error('設定檔的影片音量無效。');
      const history=data.downloadHistory===undefined?null:normalizeDownloadHistory(data.downloadHistory,true);
      const incoming=normalize(data.settings),warnings=[];
      if(incoming.customCSS.trim()&&incoming.customCSS!==settings.customCSS)warnings.push(`包含 ${incoming.customCSS.length} 字元的自訂 CSS。自訂 CSS 會直接套用到 X 頁面，可以改變按鈕和文字，也可能把頁面內容送到外部網站。`);
      if(incoming.background.startsWith('https:')&&incoming.background!==settings.background)warnings.push(`背景圖片來自 ${new URL(incoming.background).host}，該網站會看到你的 IP 位址與瀏覽時間。`);
      if(syncConfig.auto)warnings.push('已開啟自動同步，匯入的設定也會套用到其他裝置。');
      if(warnings.length&&!confirm(`匯入這份設定前請確認：\n\n${warnings.map(text=>`• ${text}`).join('\n')}\n\n只匯入你信任的檔案。要繼續嗎？`)){status('已取消匯入。');return;}
      imageRequest++;if(commit(data.settings)){if(data.videoVolume!==undefined)saveVideoVolume(data.videoVolume);if(history)saveDownloadHistory(history);}
    }catch(error){status(`匯入失敗：${error.message}`,true);}
  });
  $('#reset').addEventListener('click',()=>{if(confirm(`將所有 X 極簡設定恢復預設，並移除已儲存的背景圖片與影片音量？${syncConfig.auto?'\n\n已開啟自動同步，其他裝置也會一併恢復預設。':''}\n\n下載紀錄與同步連線不受影響。`)){imageRequest++;if(commit(DEFAULTS))saveVideoVolume(null);}});

  function apply() {
    root.dataset.xmEnabled=String(settings.enabled);
    for(const [key,value] of Object.entries(settings)) if(typeof value==='boolean') root.setAttribute(`data-xm-${key.replace(/[A-Z]/g,c=>'-'+c.toLowerCase())}`,String(value));
    root.dataset.xmLabels=settings.navLabels;
    host.dataset.labels=settings.enabled?settings.navLabels:'always';
    root.dataset.xmMode=settings.timelineMode;
    root.dataset.xmSidebarMode=settings.sidebarMode;
    root.dataset.xmImage=String(!!settings.background);
    root.style.setProperty('--xm-width',`${settings.width}px`);
    root.style.setProperty('--xm-opacity',settings.opacity/100);
    root.style.setProperty('--xm-blur',`${settings.blur}px`);
    root.style.setProperty('--xm-sidebar-blur',`${settings.sidebarBlur}px`);
    root.style.setProperty('--xm-sidebar-opacity',settings.sidebarOpacity/100);
    wallpaper.style.backgroundImage=settings.background?`url(${JSON.stringify(settings.background)})`:'none';
    wallpaper.style.filter=`brightness(${1-settings.backgroundDim/100})`;
    wallpaper.style.backgroundSize=settings.backgroundFit==='repeat'?'auto':settings.backgroundFit;
    wallpaper.style.backgroundRepeat=settings.backgroundFit==='repeat'?'repeat':'no-repeat';
    wallpaper.style.backgroundPosition=settings.backgroundPosition;
    if(navImageSource!==settings.background){
      navImageSource=settings.background;navImage=null;
      if(navImageSource){
        const source=navImageSource,image=new Image();
        if(source.startsWith('https:'))image.crossOrigin='anonymous';
        image.referrerPolicy='no-referrer';
        image.onload=()=>{if(source===navImageSource){navImage=image;schedule();}};
        image.onerror=()=>{if(source===navImageSource)schedule();};
        image.src=source;
      }
    }
    customStyle.textContent=settings.enabled?settings.customCSS:'';
  }

  const ENABLED='html[data-xm-enabled="true"]';
  const rules=(key,selector,body='display:none!important')=>`${selector.split(',').map(part=>`${ENABLED}[data-xm-${key}="true"] ${part.trim()}`).join(',')}{${body}}`;
  style.textContent=`
    [data-xm-menu-launcher]{cursor:pointer}[data-xm-menu-launcher]:is(:hover,:focus-visible,[data-highlighted]){background-color:color-mix(in srgb,currentColor 10%,transparent)}[data-xm-menu-launcher]:focus-visible{outline:2px solid #1d9bf0;outline-offset:-2px}
    .xm-media-download{position:relative;display:inline-flex;align-items:center;justify-content:center;align-self:center;flex:none;min-width:36px;height:36px;padding:0;border:0;border-radius:999px;background:transparent;font:inherit;cursor:pointer;vertical-align:middle}
    .xm-media-download:not([data-xm-native-action]){color:var(--xm-action-muted,var(--xm-reading-muted,var(--xm-muted,#536471)))}.xm-media-download:not([data-xm-native-action]):hover{background:rgb(29 155 240 / .1);color:#1d9bf0}.xm-media-download:not([data-xm-native-action]):focus-visible{outline:2px solid currentColor;outline-offset:2px}.xm-media-download:disabled{cursor:progress;opacity:.65}.xm-media-download svg{width:18.75px;height:18.75px;flex:none}.xm-media-result{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
    .xm-media-download[aria-busy] .xm-media-result,.xm-media-download[data-xm-download-error] .xm-media-result,.xm-media-download[data-xm-download-partial] .xm-media-result{width:auto;height:15px;min-width:15px;clip-path:none;overflow:visible;top:0;right:-4px;padding:0 4px;border-radius:999px;background:#1d9bf0;color:#fff;font:600 10px/15px system-ui,sans-serif;text-align:center;pointer-events:none;font-variant-numeric:tabular-nums}
    .xm-media-download[data-xm-download-error]{color:#f4212e!important}.xm-media-download[data-xm-download-error] .xm-media-result{background:#f4212e}
    .xm-media-download[data-xm-downloaded]:not([data-xm-native-action]){color:#00ba7c}
    #xm-wallpaper{display:none;position:fixed;inset:0;z-index:-2;pointer-events:none}
    ${ENABLED}[data-xm-image="true"] body{isolation:isolate;background:transparent!important}
    ${ENABLED}[data-xm-image="true"] #xm-wallpaper{display:block}
    ${ENABLED}[data-xm-image="true"] [data-xm-path]{background-color:transparent!important}
    ${ENABLED} [data-xm-primary]{width:100%!important;min-width:0!important;max-width:var(--xm-width)!important}
    ${ENABLED} [data-xm-layout="new-grid"]{grid-template-columns:minmax(0,1fr) 380px!important}
    ${ENABLED} [data-xm-shell]{max-width:calc(var(--xm-width) + 636px)!important}
    ${ENABLED}[data-xm-hide-sidebar="true"] [data-xm-layout="new-grid"]{grid-template-columns:minmax(0,1fr)!important}
    ${ENABLED}[data-xm-hide-sidebar="true"] [data-xm-shell]{max-width:calc(var(--xm-width) + 256px)!important}
    ${ENABLED}[data-xm-hide-sidebar="true"]:not([data-xm-center-timeline="true"]) [data-xm-layout="old-main"]{flex:1 1 var(--xm-width)!important;max-width:none!important}
    ${ENABLED}[data-xm-hide-sidebar="true"]:not([data-xm-center-timeline="true"]) [data-xm-layout="old-main"] [data-xm-path]{width:var(--xm-width)!important;min-width:0!important;max-width:100%!important}
    ${ENABLED}[data-xm-hide-sidebar="false"] [data-xm-layout="old-main"]{max-width:calc(var(--xm-width) + 400px)!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-shell],${ENABLED}[data-xm-center-timeline="true"] [data-xm-old-shell]{width:100%!important;max-width:var(--xm-center-max)!important;margin-inline:auto!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-layout="new-grid"]{box-sizing:border-box!important;grid-template-columns:minmax(0,1fr) var(--xm-side-width)!important;padding-inline-start:var(--xm-center-pad-start)!important;padding-inline-end:var(--xm-center-pad-end)!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-old-header]{flex:0 0 var(--xm-nav-width)!important;width:var(--xm-nav-width)!important;min-width:0!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-layout="old-main"]{box-sizing:border-box!important;flex:1 1 0!important;width:auto!important;min-width:0!important;max-width:none!important;align-items:stretch!important;padding-inline-start:var(--xm-center-pad-start)!important;padding-inline-end:var(--xm-center-pad-end)!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-layout="old-main"] [data-xm-path]:not([data-xm-old-columns]){box-sizing:border-box!important;width:100%!important;min-width:0!important;max-width:none!important}
    ${ENABLED} [data-testid="primaryColumn"] .r-1ye8kvj:is(:has([role="tablist"] [role="tab"]),:has(article)){width:100%!important;max-width:var(--xm-width)!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-old-columns]{display:flex!important;width:100%!important;min-width:0!important;max-width:none!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-old-columns]>[data-xm-primary]{box-sizing:border-box!important;flex:1 1 0!important;width:0!important;margin-inline:0!important}
    ${ENABLED}[data-xm-center-timeline="true"] [data-xm-old-columns]>[data-xm-sidebar]{flex-shrink:0!important}
    ${ENABLED}[data-xm-image="true"] [data-xm-primary]{background-color:rgb(var(--xm-rgb))!important}
    ${ENABLED}[data-xm-image="true"][data-xm-mode="glass"] [data-xm-primary]{background-color:rgb(var(--xm-rgb) / var(--xm-opacity))!important;backdrop-filter:blur(var(--xm-blur));-webkit-backdrop-filter:blur(var(--xm-blur))}
    ${ENABLED}[data-xm-image="true"][data-xm-mode="liquid"] [data-xm-primary]{background-color:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED}[data-xm-image="true"]:is([data-xm-mode="glass"],[data-xm-mode="liquid"]) [data-xm-surface]{background-color:transparent!important}
    ${ENABLED}:not([data-xm-sidebar-mode="solid"]) :is([data-slot="xds-menu-content"],[data-slot="xds-popover-content"],[data-slot="xds-hover-card-content"],[data-slot="xds-hovercard-content"],[data-base-ui-focusable][data-open][data-side],[role="menu"]):not([data-xm-ui-glass]){background:rgb(var(--xm-rgb) / max(.8,var(--xm-sidebar-opacity)))!important;backdrop-filter:blur(var(--xm-sidebar-blur));-webkit-backdrop-filter:blur(var(--xm-sidebar-blur))}
    :where(${ENABLED} [data-xm-ui-glass]){position:relative}
    ${ENABLED} [data-xm-ui-glass]{isolation:isolate;background:rgb(var(--xm-rgb) / var(--xm-sidebar-opacity))!important;backdrop-filter:blur(var(--xm-sidebar-blur));-webkit-backdrop-filter:blur(var(--xm-sidebar-blur))}
    /* Menus and popovers carry text over arbitrary media, so keep them opaque enough to read (about 4.5:1 over white or black). */
    ${ENABLED} [data-xm-ui-glass][data-xm-ui-floating]{background:rgb(var(--xm-rgb) / max(.8,var(--xm-sidebar-opacity)))!important}
    ${ENABLED} [data-xm-ui-glass]:is([data-xm-glass-renderer="webgl"],[data-xm-glass-renderer="blur"],[data-xm-glass-renderer="solid"]){background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED} [data-xm-ui-glass][data-xm-glass-merged]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}${ENABLED} [data-xm-glass-merged]>[id^="xm-liquid-ui-"]{display:none!important}
    ${ENABLED} [data-xm-ui-floating]{border-color:transparent!important;border-radius:16px!important}
    ${ENABLED} [data-xm-ui-clear],${ENABLED}[data-xm-image="true"] [data-xm-utility-path]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED} [data-xm-generated-nav-label]{margin-inline-start:0;white-space:nowrap;font-size:20px;line-height:24px}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"])>:is(span,div):has(>[data-xm-generated-nav-label]){column-gap:20px!important}
    ${ENABLED} [data-xm-timeline-menu]{translate:0 0!important}
    ${ENABLED}[data-xm-hide-native-copy-link="true"] [data-xm-share-native]{display:none!important}
    ${ENABLED} [data-xm-fixup-row]:not([data-slot]):is(:hover,:focus){background-color:color-mix(in srgb,currentColor 8%,transparent);outline:none}
    ${ENABLED} [data-xm-ui-glass]>[class~="pointer-events-none"][class~="absolute"][class*="backdrop-blur"]{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    @media(prefers-reduced-transparency:reduce){${ENABLED} [data-xm-ui-glass][data-xm-glass-renderer="off"]{background:rgb(var(--xm-rgb))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    @media(forced-colors:active){${ENABLED} [data-xm-ui-glass]{background:Canvas!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}}
    ${ENABLED}[data-xm-reading] [data-xm-primary]{color:var(--xm-reading-text);--x-fg-primary:var(--xm-reading-text);--x-fg-secondary:var(--xm-reading-muted);--x-fg-tertiary:var(--xm-reading-tertiary)}
    :where(${ENABLED}[data-xm-reading] [data-xm-primary] [data-xm-reading-preserve]){color:var(--xm-native-fg-primary);--x-fg-primary:var(--xm-native-fg-primary);--x-fg-secondary:var(--xm-native-fg-secondary);--x-fg-tertiary:var(--xm-native-fg-tertiary)}
    ${ENABLED}[data-xm-reading] [data-xm-primary] [data-xm-reading-color="primary"]{color:var(--xm-reading-text)!important}
    ${ENABLED}[data-xm-reading] [data-xm-primary] [data-xm-reading-color="secondary"]{color:var(--xm-reading-muted)!important}
    ${ENABLED}[data-xm-reading] [data-xm-primary] [data-xm-reading-color="tertiary"]{color:var(--xm-reading-tertiary)!important}
    ${ENABLED}[data-xm-reading] [data-xm-composer] :is([data-testid="toolBar"],[data-testid="ScrollSnap-List"]) :is(button,[role="button"],[role="tab"]) svg:not([data-testid^="ScrollSnap-"][data-testid$="ButtonWrapper"] *,[data-testid="tweetButtonInline"] *,[role="dialog"] *,[role="menu"] *){color:var(--xm-reading-muted)!important}
    :where(${ENABLED} [data-xm-nav-panel],${ENABLED} [data-xm-sidebar-surface]){position:relative}
    ${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface]){isolation:isolate;background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])::before{content:"";position:absolute;inset:8px;z-index:-1;pointer-events:none;border:1px solid color-mix(in srgb,var(--xm-rail-text) 14%,transparent);border-radius:24px;background:linear-gradient(145deg,rgb(255 255 255 / .12),transparent 45%,rgb(0 0 0 / .025)),rgb(var(--xm-rail-rgb) / var(--xm-rail-opacity));backdrop-filter:blur(var(--xm-sidebar-blur)) saturate(1.2);-webkit-backdrop-filter:blur(var(--xm-sidebar-blur)) saturate(1.2);box-shadow:0 8px 24px rgb(0 0 0 / .1),inset 0 1px 0 rgb(255 255 255 / .22)}
    ${ENABLED}[data-xm-sidebar-mode="solid"] :is([data-xm-nav-panel],[data-xm-sidebar-surface])::before{background:rgb(var(--xm-rail-rgb))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface]):is([data-xm-rail-renderer="webgl"],[data-xm-rail-renderer="blur"],[data-xm-rail-renderer="solid"])::before{background:linear-gradient(145deg,rgb(255 255 255 / .12),transparent 45%,rgb(0 0 0 / .025))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}
    ${ENABLED} [data-xm-nav-panel]{--xm-rail-rgb:var(--xm-nav-rgb);--xm-rail-text:var(--xm-nav-text);--xm-rail-opacity:var(--xm-nav-opacity);color:var(--xm-nav-text)!important;--x-fg-primary:var(--xm-nav-text);--x-fg-secondary:var(--xm-nav-muted);--x-fg-tertiary:var(--xm-nav-muted);--x-btn-ghost-hover:var(--xm-nav-hover)}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]),${ENABLED} [data-xm-nav] svg,${ENABLED} [data-xm-nav-label],${ENABLED} [data-xm-nav-label] *,${ENABLED} [data-xm-nav-panel] [data-xm-logo] svg{color:var(--xm-nav-text)!important}
    ${ENABLED} [data-xm-nav-panel] [data-xm-logo]{box-sizing:border-box;display:flex;align-items:center;justify-content:center;align-self:flex-start;flex:0 0 40px;width:40px!important;height:40px!important;min-width:40px;min-height:40px;margin-inline:16px 0!important;margin-block:16px!important;padding:8px!important;border:0!important;border-radius:12px!important;background:transparent!important;color:var(--xm-nav-text)!important}
    ${ENABLED} [data-xm-nav-panel] [data-xm-logo] svg{display:block;width:24px!important;height:24px!important;flex:none}
    ${ENABLED} [data-xm-nav-panel] [data-xm-logo]:hover{background:var(--xm-nav-hover)!important}
    ${ENABLED} [data-xm-nav-panel] div:has(>h1>[data-xm-logo]){align-self:flex-start!important;padding-block:0!important}
    ${ENABLED} [data-xm-nav-panel]>:has([data-xm-logo]){background:transparent!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]),${ENABLED} [data-xm-nav] :is(a,button,[role="button"]):is(:hover,:focus-visible,[aria-current="page"]){background:transparent!important;border-radius:12px!important}
    ${ENABLED} [data-xm-nav]{padding-inline:0!important;width:256px!important;min-width:256px!important;align-self:flex-start!important}
    ${ENABLED} [data-xm-nav-panel]{overflow-x:clip!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]){box-sizing:border-box!important;flex-grow:0!important;flex-shrink:0!important;width:100%!important;align-items:flex-start!important;padding-inline:12px!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"])>:is(span,div):first-child{box-sizing:border-box!important;padding:12px!important;min-height:48px;height:48px;align-items:center;flex-shrink:0!important;min-width:max-content!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]) svg{width:24px!important;height:24px!important;flex-shrink:0}
    ${ENABLED} [data-xm-nav] .outline-focus>[aria-hidden="true"]:has(svg){width:24px!important;height:24px!important;flex:none!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"])>:is(span,div):first-child{border-radius:12px!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]):is(:hover,:focus-visible,[aria-current="page"])>:is(span,div):first-child{background-color:var(--xm-nav-hover)!important}
    ${ENABLED} [data-xm-nav] :is(a,button,[role="button"]):not(:has(>span,>div)):is(:hover,:focus-visible,[aria-current="page"]){background-color:var(--xm-nav-hover)!important}
    ${ENABLED} [data-xm-nav-account] :is(span,div,svg){color:var(--xm-nav-text)!important}
    ${ENABLED} [data-xm-sidebar]{color:var(--xm-rail-text);--x-fg-primary:var(--xm-rail-text);--x-fg-secondary:var(--xm-rail-muted);--x-fg-tertiary:var(--xm-rail-muted)}
    ${ENABLED} [data-xm-sidebar]{padding:0!important}
    ${ENABLED} [data-xm-sidebar-surface]{box-sizing:border-box;position:sticky!important;top:8px!important;width:calc(100% - 16px)!important;max-width:calc(100% - 16px)!important;margin:8px!important;padding:16px 0!important;border-radius:24px;row-gap:0!important;max-height:calc(100dvh - 16px);overflow-x:hidden;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin}
    ${ENABLED} [data-xm-sidebar-surface]::before{inset:0}
    ${ENABLED} [data-xm-search-path]{width:100%!important;min-width:0!important;max-width:100%!important}
    ${ENABLED} [data-xm-search-list]{padding-block:0!important}
    ${ENABLED} [data-xm-search-spacer]{display:none!important}
    ${ENABLED} [data-xm-search-host]{box-sizing:border-box!important;position:sticky!important;z-index:2;width:100%!important;max-width:100%!important;top:0!important;padding:0!important;margin:0!important;background:transparent!important}
    ${ENABLED} [data-xm-sidebar-surface] [data-xm-sidebar-card]{margin:0!important;border:0!important;border-radius:0!important;background:none!important;box-shadow:none!important;overflow:visible!important}
    ${ENABLED} [data-xm-sidebar-surface] [data-xm-sidebar-module]{padding:0!important}
    ${ENABLED} [data-xm-sidebar-surface] aside[data-xm-sidebar-card][role="complementary"]:not(:has(h2,h3)){padding:16px!important}
    ${ENABLED} [data-xm-sidebar-surface] [data-xm-sidebar-card]:has(>h2,>h3){padding:16px!important}
    ${ENABLED} [data-xm-sidebar-surface] [data-xm-sidebar-card]+[data-xm-sidebar-card]{border-top:1px solid color-mix(in srgb,var(--xm-rail-text) 10%,transparent)!important}
    ${ENABLED} [data-xm-sidebar-surface] [class~="before:bg-primary"]{margin-block:0!important;padding-block:0!important;background:none!important}
    ${ENABLED} [data-xm-sidebar-surface] [class~="before:bg-primary"]::before{content:none!important}
    ${ENABLED} [data-xm-sidebar-surface] [data-xm-search]{box-sizing:border-box!important;width:calc(100% - 32px)!important;min-width:0!important;max-width:calc(100% - 32px)!important;margin-inline:16px!important;margin-bottom:8px!important}
    ${ENABLED} [data-xm-sidebar-surface]>footer{margin:0!important;padding:16px 16px 0!important}
    ${ENABLED} [data-xm-sidebar] [data-xm-search]{border-color:transparent!important}
    ${ENABLED} [data-xm-sidebar] [data-xm-rail-color="primary"]{color:var(--xm-rail-text)!important}
    ${ENABLED} [data-xm-sidebar] [data-xm-rail-color="secondary"]{color:var(--xm-rail-muted)!important}
    ${ENABLED} [data-xm-sidebar] [data-xm-search] input{color:var(--xm-rail-text)}
    ${ENABLED} [data-xm-sidebar] :is([role="dialog"],[role="menu"],[role="listbox"],[data-slot="xds-popover-content"]){color:var(--xm-text);--x-fg-primary:var(--xm-text);--x-fg-secondary:var(--xm-muted);--x-fg-tertiary:var(--xm-muted);--xm-rail-text:var(--xm-text);--xm-rail-muted:var(--xm-muted)}
    ${ENABLED}[data-xm-nav-align-left="true"] [data-xm-edge-nav],${ENABLED}[data-xm-right-align-sidebar="true"] [data-xm-edge-sidebar]{translate:var(--xm-edge-x,0px) 0}
    ${ENABLED}[data-xm-nav-align-left="true"] header[role="banner"]:has([data-xm-edge-nav]){overflow:visible!important}
    ${ENABLED}[data-xm-nav-align-left="true"] [class~="overflow-x-clip"]:has([data-xm-nav-panel]){overflow-x:visible!important}
    ${ENABLED}:is([data-xm-nav-align-left="true"],[data-xm-right-align-sidebar="true"]) [data-xm-shell]{overflow-x:visible!important}
    ${ENABLED} [data-xm-primary] [id^="urt:"]{max-width:100%!important;--x-timeline-max-width:var(--xm-width)}
    ${rules('hide-sidebar','[data-xm-sidebar]')}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar]{display:block!important;position:fixed!important;inset:0 24px auto auto!important;z-index:3!important;width:var(--xm-floating-search-width,350px)!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:none!important;translate:none!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] :not([data-xm-search-box],[data-xm-search-box] *,:has([data-xm-search-box])){display:none!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] :is(:has([data-xm-search-box]),[data-xm-search-box]){width:100%!important;min-width:0!important;max-width:none!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;border:0!important;background:none!important;translate:none!important;overflow:visible!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] :has([data-xm-search-box]){position:static!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] :is(:has([data-xm-search-box]),[data-xm-search-box])::before{display:none!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] [data-xm-search-box]{padding-block:8px!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] [data-xm-search]{width:100%!important;max-width:none!important;margin:0!important}
    ${ENABLED}[data-xm-floating-search="true"] [data-xm-sidebar] :is([data-xm-search][data-xm-ui-glass] :is([data-xm-search-fill],[data-slot="xds-combobox-input-group"]),[data-xm-search-fill][data-xm-ui-glass]){background-color:transparent!important}
    ${rules('remove-borders','[data-xm-primary]','border-left:0!important;border-right:0!important')}
    ${rules('remove-post-borders','[data-xm-post-divider]','border-block-color:transparent!important')}
    /* X keeps stale virtual-row offsets at zero height; one invisible pixel triggers its native measurement. */
    ${rules('hide-ads','[data-xm-ad]','visibility:hidden!important;pointer-events:none!important;max-height:1px!important;min-height:1px!important;height:1px!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important')}
    ${rules('hide-premium-upsell','[data-xm-premium-upsell]')}
    ${rules('hide-suggestions','[data-xm-suggestion]')}
    ${rules('hide-suggestions','li[data-index][data-xm-suggestion],li[data-index]:has([data-xm-suggestion]),[data-testid="cellInnerDiv"][data-xm-suggestion]','display:block!important;visibility:hidden!important;pointer-events:none!important;max-height:1px!important;min-height:1px!important;height:1px!important;overflow:hidden!important;margin:0!important;padding:0!important;border:0!important')}
    ${ENABLED}[data-xm-home="true"][data-xm-hide-top-tabs="true"] [data-xm-home-tabs]{display:none!important}
    ${ENABLED}[data-xm-home="true"][data-xm-hide-composer="true"] [data-xm-composer]{display:none!important}
    ${rules('hide-view-count','[data-xm-primary] a[href$="/analytics"],a[href*="/status/"][href$="/analytics"]')}
    ${rules('hide-reply-count','[data-engagement-action="reply"] .x-animated-count-visual,[data-testid="reply"] [data-testid="app-text-transition-container"]')}
    ${rules('hide-repost-count','[data-engagement-action="retweet"] .x-animated-count-visual,[data-testid="retweet"] [data-testid="app-text-transition-container"],[data-testid="unretweet"] [data-testid="app-text-transition-container"]')}
    ${rules('hide-like-count','[data-engagement-action="like"] .x-animated-count-visual,[data-testid="like"] [data-testid="app-text-transition-container"],[data-testid="unlike"] [data-testid="app-text-transition-container"]')}
    ${rules('hide-follow-count','[data-xm-follow-count]')}
    ${rules('hide-logo','[data-xm-logo]')}
    ${rules('hide-unread','[data-xm-nav] [aria-live],[data-xm-nav] [data-testid="icon-badge"],[data-xm-nav] [aria-hidden="true"]>[class~="pointer-events-none"][class~="absolute"]')}
    ${rules('hide-grok','[data-testid="GrokDrawer"],[data-testid="GrokDrawerHeader"],[data-xm-grok]')}
    ${rules('hide-chat-drawer','[data-testid="DMDrawer"],[data-testid="chat-drawer-root"],[data-testid="xchatEmbedDrawer"],[data-xm-chat-dock]')}
    ${rules('hide-search','[data-xm-sidebar] [data-xm-search],[data-xm-sidebar] [data-xm-search-host]')}
    ${rules('transparent-search','[data-xm-search], [data-xm-search-fill], [data-xm-search] [data-slot="xds-combobox-input-group"]','background-color:transparent!important')}
    ${rules('hide-post-button','[data-xm-post-button],[data-xm-post-host]')}
    ${ENABLED} [data-xm-post-host]{box-sizing:border-box!important;width:256px!important;min-width:0!important;margin:12px 0!important;padding:0!important;flex-shrink:0}
    ${ENABLED} [data-xm-nav-panel] [data-xm-post-button]{--xm-post-icon:url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="1.8" stroke-linejoin="round"><path d="m14 5 5 5M4 20l4-1L21 6a2.12 2.12 0 0 0-3-3L5 16z"/></svg>')}");box-sizing:border-box!important;display:flex;flex-direction:row!important;align-items:center!important;justify-content:flex-start!important;gap:20px;width:232px!important;min-width:0!important;height:48px!important;min-height:48px!important;margin-inline:12px!important;padding:12px!important;border-radius:24px!important;flex-shrink:0}
    ${ENABLED} [data-xm-nav-panel] [data-xm-post-button]::before{content:"";display:block;width:24px;height:24px;flex:0 0 24px;background:var(--xm-post-ink,currentColor);mask:var(--xm-post-icon) center/contain no-repeat;-webkit-mask:var(--xm-post-icon) center/contain no-repeat}
    ${ENABLED} [data-xm-nav-panel] [data-xm-post-button]>:is(div,span){flex:none!important;min-width:0!important;height:auto!important;min-height:0!important;margin:0!important;padding:0!important;justify-content:flex-start!important;text-align:start!important}
    ${ENABLED} [data-xm-nav-panel] [data-xm-post-button] svg{display:none!important}
    ${ENABLED} [data-xm-nav-panel] [data-xm-post-icon-only="true"]::after{content:attr(aria-label);color:var(--xm-post-ink,currentColor);font-size:20px;line-height:24px;white-space:nowrap}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-nav-panel] [data-xm-post-button]{width:48px!important}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-nav-panel] [data-xm-post-button]>*{display:none!important}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-nav-panel] [data-xm-post-button]::after{display:none}
    ${rules('system-font','body,body button,body input,body textarea','font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important')}
    ${ENABLED} [data-xm-nav-hidden="true"]{display:none!important}
    ${ENABLED} [data-xm-tabbar]>:has([data-xm-nav-hidden="true"]):not(:has([data-xm-nav-hidden="false"])){display:none!important}
    ${ENABLED} [data-xm-tabbar] [data-xm-nav-label]{display:none!important}
    :where(${ENABLED} [data-xm-nav-rail]){position:relative}
    /* Motion Prompt #050 · MIT License (c) 2026 Shohei Ohtaki · https://showheyohtaki.github.io/motion-prompt/#050 */
    /* Drawer timing adapted to a width reveal so the icon rail stays in place. */
    ${ENABLED}[data-xm-nav-compact="true"] [data-xm-nav-panel]{transition:width 350ms linear(0.000000,0.000122,0.000977,0.003296,0.007812,0.015259,0.026367,0.041870,0.062500,0.088989,0.122070,0.162476,0.210938,0.268188,0.334961,0.411987,0.500000,0.588013,0.665039,0.731812,0.789062,0.837524,0.877930,0.911011,0.937500,0.958130,0.973633,0.984741,0.992188,0.996704,0.999023,0.999878,1.000000)}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="true"] [data-xm-nav-panel]{transition:width 380ms cubic-bezier(.333333,1,.666667,1)}
    ${ENABLED}[data-xm-nav-compact="true"] [class~="overflow-x-clip"]:has([data-xm-nav-panel]){--x-nav-open:0!important}
    ${ENABLED}[data-xm-nav-compact="false"] [class~="overflow-x-clip"]:has([data-xm-nav-panel]){--x-nav-open:1!important}
    ${ENABLED} [data-xm-nav-panel]>div:has([data-xm-nav]){box-sizing:border-box!important;width:256px!important;min-width:256px!important;max-width:256px!important;overflow-x:clip!important;padding-inline:0!important}
    ${ENABLED} [data-xm-account-host]{width:100%!important;min-width:0!important;margin:0!important;flex-shrink:0}
    ${ENABLED} [data-xm-account-wrap]{box-sizing:border-box;width:100%;margin-top:auto;padding:8px 16px 16px!important;flex-shrink:0}
    ${ENABLED} [data-xm-nav-account]{box-sizing:border-box;display:flex!important;align-items:center!important;width:100%;height:48px!important;min-height:0!important;padding:4px!important;border-radius:12px!important}
    ${ENABLED} [data-xm-account-avatar]{width:32px!important;height:32px!important;flex-shrink:0}
    ${ENABLED} [data-xm-account-avatar] img{width:100%;height:100%}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-nav-account]{height:48px!important;width:40px!important}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-account-detail]{display:none!important}
    @media(prefers-reduced-motion:reduce){${ENABLED} [data-xm-nav-panel]{transition:none!important}}
    ${ENABLED}[data-xm-nav-compact="true"] [data-xm-nav-rail]{box-sizing:border-box!important;width:72px!important;min-width:72px!important;flex:0 0 72px!important;overflow:visible!important}
    ${ENABLED}[data-xm-nav-compact="false"] [data-xm-nav-panel]{width:256px!important;--x-sidebar-expanded:1!important}
    ${ENABLED}[data-xm-nav-compact="true"] [data-xm-nav-panel]{width:72px!important;--x-sidebar-expanded:0!important}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="true"] [data-xm-nav-panel]{width:256px!important;--x-sidebar-expanded:1!important}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="true"] [data-xm-nav-rail]{z-index:30}
    ${ENABLED}[data-xm-nav-compact="true"][data-xm-nav-expanded="false"] [data-xm-nav-label]{display:none!important}
    ${ENABLED}[data-xm-labels="hidden"] [data-xm-nav-label],${ENABLED}[data-xm-labels="hover"] [data-xm-nav-label]{opacity:0!important}
    ${ENABLED}[data-xm-labels="hidden"] [data-xm-nav-label],${ENABLED}[data-xm-labels="hover"]:not([data-xm-nav-expanded="true"]) [data-xm-nav-label]{display:none!important}
    ${ENABLED}[data-xm-labels="hover"][data-xm-nav-expanded="true"] [data-xm-nav-label]{opacity:1!important}
    ${ENABLED}[data-xm-center-nav="true"] [data-xm-nav]{justify-content:center!important;flex-grow:1}
    ${ENABLED}[data-xm-center-nav="true"] [data-xm-nav-stack]{flex-grow:1!important;min-height:0!important}
    ${ENABLED}[data-xm-sticky-header="false"] [data-xm-header]{position:relative!important;top:auto!important}
    ${ENABLED}[data-xm-zen="true"][data-xm-home="true"] [data-xm-feed],${ENABLED}[data-xm-zen="true"][data-xm-home="true"] [data-xm-home-tabs],${ENABLED}[data-xm-zen="true"][data-xm-home="true"] [data-xm-sidebar]{display:none!important}
    ${ENABLED}[data-xm-zen="true"][data-xm-home="true"] [data-xm-composer]{display:block!important}
    @media(max-width:1023px){${ENABLED} [data-xm-layout="new-grid"]{grid-template-columns:minmax(0,1fr)!important}}
    @media(max-width:699px){${ENABLED} [data-xm-primary]{max-width:100%!important}}
    @supports not ((backdrop-filter:blur(1px)) or (-webkit-backdrop-filter:blur(1px))){${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])::before{background:rgb(var(--xm-rail-rgb))!important}}
    @media(prefers-reduced-transparency:reduce){${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])::before{background:rgb(var(--xm-rail-rgb))!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])[data-xm-rail-renderer="solid"]::before{background:none!important}}
    @media(forced-colors:active){${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])::before{background:Canvas!important;border-color:CanvasText;box-shadow:none;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}${ENABLED} :is([data-xm-nav-panel],[data-xm-sidebar-surface])[data-xm-rail-renderer="solid"]::before{background:none!important}}
  `;

  function mark(element,name,value='') { if(element&&element.getAttribute(`data-xm-${name}`)!==value)element.setAttribute(`data-xm-${name}`,value); }
  function unmark(element,name) { if(element?.hasAttribute(`data-xm-${name}`))element.removeAttribute(`data-xm-${name}`); }
  let paths=new Set(),surfaces=new Set();
  let chatRoot=null,chatObserver=null,chatStyle=null,chatProbe=0;
  let followedPrimary=null;
  let lastRoute='';
  let originalTitle='',cleanTitle='';
  let activeNav=null,activeNavPanel=null,navPointerInside=false,navHoverReady=false,navHoverTimer=0;
  const boundNavs=new WeakSet();
  function compactNavigation(){return settings.enabled&&(settings.navLabels!=='always'||innerWidth<Math.max(1280,settings.width+256+(settings.hideSidebar?0:380)));}
  function updateLauncherState(nav){
    const compact=compactNavigation();
    const keyboard=!!nav?.querySelector(':focus-visible')||(shadow.activeElement===$('#launcher')&&$('#launcher').matches(':focus-visible'));
    const expanded=!compact||settings.navLabels!=='hidden'&&(navHoverReady||keyboard);
    root.dataset.xmNavCompact=String(compact);root.dataset.xmNavExpanded=String(expanded);
    host.dataset.labels=settings.enabled?(compact?(settings.navLabels==='hidden'?'hidden':'hover'):settings.navLabels):'always';
    host.toggleAttribute('data-nav-expanded',expanded);
  }
  function navigationPointer(inside){
    if(inside===navPointerInside)return;
    navPointerInside=inside;clearTimeout(navHoverTimer);navHoverTimer=0;
    if(!inside){navHoverReady=false;updateLauncherState(activeNav);schedule();return;}
    if(root.dataset.xmNavExpanded==='true'&&settings.navLabels!=='hidden'){navHoverReady=true;updateLauncherState(activeNav);return;}
    navHoverTimer=setTimeout(()=>{navHoverTimer=0;if(navPointerInside&&settings.navLabels!=='hidden'){navHoverReady=true;updateLauncherState(activeNav);schedule();}},240);
  }
  function bindNavigation(nav){
    const panel=document.querySelector('[data-xm-nav-panel]')||nav;
    if(activeNavPanel!==panel){clearTimeout(navHoverTimer);navHoverTimer=0;navPointerInside=navHoverReady=false;}
    activeNav=nav;activeNavPanel=panel;
    for(const previous of document.querySelectorAll('[data-xm-nav-rail]'))if(previous!==panel?.parentElement)unmark(previous,'nav-rail');
    mark(panel?.parentElement,'nav-rail');
    for(const target of new Set([panel,nav]))if(target&&!boundNavs.has(target)){
      boundNavs.add(target);
      target.addEventListener('mouseenter',()=>navigationPointer(true));
      target.addEventListener('mouseleave',event=>{if(event.relatedTarget instanceof Node&&activeNavPanel?.contains(event.relatedTarget))return;navigationPointer(false);});
      for(const event of ['focusin','focusout'])target.addEventListener(event,()=>queueMicrotask(()=>{updateLauncherState(activeNav);schedule();}));
    }
    updateLauncherState(nav);
  }
  for(const event of ['focus','blur'])$('#launcher').addEventListener(event,()=>queueMicrotask(()=>updateLauncherState(activeNav)));
  function xPath(element){
    const href=element.getAttribute('href');if(!href)return '';
    try{const url=new URL(href,location.origin);return url.origin===location.origin||['x.com','www.x.com','twitter.com','www.twitter.com'].includes(url.hostname)?url.pathname.replace(/\/+$/,'')||'/':'';}catch{return '';}
  }
  function ownsPostContent(article,element){
    if(element.closest('article')!==article)return false;
    const quote=element.closest('[data-slot="embedded-tweet-frame"],[data-testid="quoteTweet"]');
    return !quote||!article.contains(quote);
  }
  const SHARE_MENU='[role="menu"],[data-slot="xds-menu-content"]';
  const COPY_LINK=/^(copy (?:post )?link|copy link to (?:post|tweet)|複製(?:貼文)?連[結接]|复制(?:帖子)?链接|リンクをコピー|ポストのリンクをコピー)$/i;
  const SHARE_TRIGGER='[data-testid="share"],[data-engagement-action="share"]';
  let shareCopy=null;
  function updateShareMenu(){
    const trigger=settings.enabled&&settings.fixupCopy?[...document.querySelectorAll('article [aria-expanded="true"][aria-haspopup="menu"]')].find(button=>
      button.closest(SHARE_TRIGGER)||button.querySelector(SHARE_TRIGGER)||/^(share(?: post| tweet)?|分享(?:貼文|推文|帖子)?|(?:ポスト|ツイート)を共有)$/i.test(button.getAttribute('aria-label')||'')
    ):null;
    const article=trigger?.closest('article');
    const links=article&&ownsPostContent(article,trigger)?[...article.querySelectorAll('a[href*="/status/"]')].filter(link=>ownsPostContent(article,link)):[];
    const paths=links.map(link=>({link,path:xPath(link)})).filter(({path})=>/^\/(?:[a-z0-9_]+|i\/web)\/status\/\d+$/i.test(path));
    const path=(paths.find(({link})=>link.querySelector('time'))||paths[0])?.path;
    const url=path&&`https://fixupx.com${path.replace(/^\/i\/web\//i,'/i/')}`;
    const controlled=trigger&&document.getElementById(trigger.getAttribute('aria-controls'));
    const native=url&&[...(controlled||document).querySelectorAll('[role="menuitem"]')].find(item=>{
      if(item.hasAttribute('data-xm-fixup-row')||!item.closest(SHARE_MENU)?.getClientRects().length)return false;
      if(item!==shareCopy?.native&&!item.getClientRects().length)return false;
      return item.matches('[data-testid="copyLink"]')||COPY_LINK.test(item.getAttribute('aria-label')||'')||COPY_LINK.test(item.textContent.trim());
    });
    if(shareCopy&&shareCopy.native===native&&shareCopy.url===url&&shareCopy.row.isConnected)return;
    if(shareCopy){
      unmark(shareCopy.native,'share-native');
      shareCopy.row.remove();
      shareCopy=null;
    }
    if(!native)return;
    const row=native.cloneNode(true);
    for(const element of [row,...row.querySelectorAll('[id]')])element.removeAttribute('id');
    for(const attribute of ['data-testid','href','aria-label','aria-labelledby','data-highlighted'])row.removeAttribute(attribute);
    row.tabIndex=-1;
    mark(row,'fixup-row');
    const label=[...row.querySelectorAll('span,div')].find(element=>!element.childElementCount&&element.textContent.trim()===native.textContent.trim())||row;
    label.textContent='複製 FixupX 連結';
    label.setAttribute('aria-live','polite');
    const copy=async event=>{
      if(!event.isTrusted)return;
      event.preventDefault();
      event.stopPropagation();
      try{
        await navigator.clipboard.writeText(url);
        label.textContent='已複製連結';
        // Close the menu the way the native item does, after the confirmation is announced.
        setTimeout(()=>closeShareMenu(row,trigger),450);
      }catch{
        label.textContent='複製失敗，點擊重試';
        unmark(native,'share-native');
      }
    };
    row.addEventListener('click',copy);
    row.addEventListener('pointermove',()=>{if(row.isConnected&&document.activeElement!==row)row.focus({preventScroll:true});});
    // The new UI paints the hover/keyboard highlight from data-highlighted, which X only sets on its own items.
    row.addEventListener('focus',()=>row.setAttribute('data-highlighted',''));
    row.addEventListener('blur',()=>row.removeAttribute('data-highlighted'));
    // X's menus move focus between the items they registered; the copied row joins that order here.
    const items=()=>[...row.closest(SHARE_MENU)?.querySelectorAll('[role="menuitem"]')||[]].filter(item=>item.getClientRects().length);
    row.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){copy(event);return;}
      if(event.key!=='ArrowDown'&&event.key!=='ArrowUp')return;
      const list=items(),index=list.indexOf(row),next=list[(index+(event.key==='ArrowDown'?1:-1)+list.length)%list.length];
      if(next&&next!==row){event.preventDefault();event.stopPropagation();next.focus();}
    });
    const enter=event=>{
      if(!row.isConnected||!event.isTrusted)return;
      const list=items(),index=list.indexOf(event.currentTarget);
      if(index<0)return;
      const step=event.key==='ArrowDown'?1:event.key==='ArrowUp'?-1:0;
      if(step&&list[(index+step+list.length)%list.length]===row){event.preventDefault();event.stopPropagation();row.focus();}
    };
    native.after(row);
    for(const item of items()){if(item!==row&&!item.hasAttribute('data-xm-fixup-keys')){item.setAttribute('data-xm-fixup-keys','');item.addEventListener('keydown',enter);}}
    mark(native,'share-native');
    shareCopy={row,native,url};
  }
  function closeShareMenu(row,trigger){
    if(!row.isConnected)return;
    const options={key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true,composed:true};
    // The new UI closes on keydown; the old React Native Web dropdown closes on keyup.
    const escape=target=>{for(const type of ['keydown','keyup'])target.dispatchEvent(new KeyboardEvent(type,options));};
    escape(row);
    setTimeout(()=>{
      if(!row.isConnected||!row.getClientRects().length)return;
      escape(document);
      if(row.isConnected&&trigger?.getAttribute('aria-expanded')==='true')trigger.focus();
    },60);
  }
  function markControl(control,name){
    const dock=control.closest('[data-slot="xds-dock-window"],[data-slot="xds-dock-item"]');
    mark(control.closest('[data-slot="xds-dock-panel"]')?control:dock||control,name);
  }
  function isReadingSurface(element){
    if(element.closest('button,a,[role="button"],[role="slider"],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-slot="xds-popover-content"],[data-testid="tweetPhoto"],[data-testid="videoPlayer"],[data-testid="card.wrapper"]'))return false;
    if(element.querySelector(':scope > img,:scope > video')||element.children.length===1&&element.firstElementChild.matches('button,[role="button"]'))return false;
    return true;
  }
  function sampleWallpaper(rect){
    let rgb=themeRGB;
    if(settings.enabled&&settings.background&&navImage?.naturalWidth&&rect){
      try{
        const scale=96/innerWidth,canvas=document.createElement('canvas');
        canvas.width=96;canvas.height=Math.max(1,Math.round(innerHeight*scale));
        const context=canvas.getContext('2d',{willReadFrequently:true});
        const size=settings.backgroundFit==='repeat'?1:settings.backgroundFit==='contain'?Math.min(innerWidth/navImage.naturalWidth,innerHeight/navImage.naturalHeight):Math.max(innerWidth/navImage.naturalWidth,innerHeight/navImage.naturalHeight);
        const width=navImage.naturalWidth*size,height=navImage.naturalHeight*size;
        const x=(innerWidth-width)/2,y=settings.backgroundPosition==='top'?0:settings.backgroundPosition==='bottom'?innerHeight-height:(innerHeight-height)/2;
        if(settings.backgroundFit==='repeat'){
          context.save();context.scale(scale,scale);context.translate(x,y);
          context.fillStyle=context.createPattern(navImage,'repeat');context.fillRect(-x,-y,innerWidth,innerHeight);context.restore();
        }else context.drawImage(navImage,x*scale,y*scale,width*scale,height*scale);
        const left=Math.max(0,Math.min(95,Math.floor(rect.left*scale))),top=Math.max(0,Math.min(canvas.height-1,Math.floor(rect.top*scale)));
        const pixels=context.getImageData(left,top,Math.max(1,Math.min(96-left,Math.ceil(rect.width*scale))),Math.max(1,Math.min(canvas.height-top,Math.ceil(rect.height*scale)))).data;
        const sum=[0,0,0],dim=1-settings.backgroundDim/100;
        for(let i=0;i<pixels.length;i+=4)for(let c=0;c<3;c++)sum[c]+=pixels[i+c]*dim*pixels[i+3]/255+themeRGB[c]*(1-pixels[i+3]/255);
        rgb=sum.map(value=>value/(pixels.length/4));
      }catch{ /* Unreadable remote images can use the manual text tone. */ }
    }
    return rgb;
  }
  function colorRGB(value){
    if(typeof value!=='string')return null;
    value=value.trim();
    if(/^#[\da-f]{3}$/i.test(value))value='#'+[...value.slice(1)].map(c=>c+c).join('');
    if(/^#[\da-f]{6}$/i.test(value))return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16));
    if(/^rgba?\(/.test(value)){
      const channels=value.match(/[\d.]+/g)?.map(Number);
      return channels?.length>=3&&channels[3]!==0?channels.slice(0,3):null;
    }
    return null;
  }
  function luminance(rgb){return rgb.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);}
  function contrastRatio(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
  let readingColors=new Set(),readingPreserves=new Set();
  const readingRoles=new WeakMap();
  function updateReadingTheme(primary){
    const nextColors=new Set(),nextPreserves=new Set();
    const transparent=settings.enabled&&settings.background&&settings.timelineMode!=='solid'&&primary;
    let tone='';
    if(transparent){
      const nativeDark=luminance(themeRGB)<.179;
      const body=getComputedStyle(document.body);
      const nativePrimary=body.getPropertyValue('--x-fg-primary').trim()||(nativeDark?'#eff3f4':'#0f1419');
      const nativeSecondary=body.getPropertyValue('--x-fg-secondary').trim()||(nativeDark?'#71767b':'#536471');
      const nativeTertiary=body.getPropertyValue('--x-fg-tertiary').trim()||nativeSecondary;
      const primaryRGB=colorRGB(nativePrimary)||[...themeRGB].map(()=>nativeDark?255:0);
      const legacy=primary.matches('[data-testid="primaryColumn"]');
      const secondaryRGB=colorRGB(legacy?(nativeDark?'#71767b':'#536471'):nativeSecondary)||primaryRGB;
      const background=sampleWallpaper(primary.getBoundingClientRect()).map((c,i)=>c*(1-settings.opacity/100)+themeRGB[i]*settings.opacity/100);
      if(settings.readingTextTone!=='auto'||contrastRatio(primaryRGB,background)<4.5||contrastRatio(secondaryRGB,background)<7){
        tone=settings.readingTextTone==='auto'?(luminance(background)<.179?'light':'dark'):settings.readingTextTone;
        const light=tone==='light';
        const ink=light?'#fff':'#000',readable=color=>contrastRatio(colorRGB(color),background)<4.5?ink:color;
        const vars={'--xm-reading-text':ink,'--xm-reading-muted':readable(light?'#e6edf2':'#1b242c'),'--xm-reading-tertiary':readable(light?'#d4dfe7':'#202830'),'--xm-native-fg-primary':nativePrimary,'--xm-native-fg-secondary':nativeSecondary,'--xm-native-fg-tertiary':nativeTertiary};
        for(const [key,value] of Object.entries(vars))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
        for(const element of primary.querySelectorAll('[data-testid="tweetPhoto"],[data-testid="videoPlayer"],[data-testid="card.wrapper"],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-slot="xds-popover-content"],.bg-primary,[class~="bg-primary/80"],[style*="background-color"]')){
        if(element.style.backgroundColor&&!colorRGB(getComputedStyle(element).backgroundColor)&&!element.matches('.bg-primary,[class~="bg-primary/80"],[data-testid="tweetPhoto"],[data-testid="videoPlayer"],[data-testid="card.wrapper"],[role="dialog"],[role="menu"],[role="listbox"],[role="tooltip"],[data-slot="xds-popover-content"]'))continue;
          if(!isReadingSurface(element)){nextPreserves.add(element);mark(element,'reading-preserve');}
        }
        for(const previous of readingPreserves)if(!nextPreserves.has(previous))unmark(previous,'reading-preserve');
        const known={'0 0 0':'primary','15 20 25':'primary','20 23 26':'primary','255 255 255':'primary','239 243 244':'primary','231 233 234':'primary','83 100 113':'secondary','101 119 134':'secondary','102 102 102':'secondary','113 118 123':'secondary','139 152 165':'secondary','153 153 153':'secondary','160 166 172':'secondary','110 118 125':'tertiary','178 178 178':'tertiary'};
      const candidates=primary.querySelectorAll(legacy?'span,a,div,svg,button,[role="button"]':'[style*="color"],.text-primary,.text-secondary,.text-tertiary');
        const themeKey=themeRGB.join(' ')+nativePrimary+nativeSecondary;
        for(const element of candidates){
          if(element.closest('[data-xm-reading-preserve],[data-xm-download]'))continue;
        if(!element.style.color&&!element.matches('svg,button,[role="button"],.text-primary,.text-secondary,.text-tertiary')&&![...element.childNodes].some(node=>node.nodeType===3&&node.textContent.trim()))continue;
        const control=element.closest('button,[role="button"],a');
        const signature=themeKey+element.getAttribute('class')+element.getAttribute('style')+control?.getAttribute('class')+control?.getAttribute('style')+control?.getAttribute('aria-pressed')+control?.getAttribute('aria-selected');
          let cached=readingRoles.get(element);
          if(!cached||cached.signature!==signature){
            unmark(element,'reading-color');
            const rgb=colorRGB(element.style.color||getComputedStyle(element).color);
            const key=rgb?.map(Math.round).join(' ');
            const role=key===primaryRGB.map(Math.round).join(' ')?'primary':key===secondaryRGB.map(Math.round).join(' ')?'secondary':known[key];
            cached={signature,role};readingRoles.set(element,cached);
          }
          if(cached.role){nextColors.add(element);mark(element,'reading-color',cached.role);}
        }
      }
    }
    for(const previous of readingColors)if(!nextColors.has(previous))unmark(previous,'reading-color');
    for(const previous of readingPreserves)if(!nextPreserves.has(previous))unmark(previous,'reading-preserve');
    readingColors=nextColors;readingPreserves=nextPreserves;
    if(tone){if(root.dataset.xmReading!==tone)root.dataset.xmReading=tone;}
    else {
      if(root.hasAttribute('data-xm-reading'))root.removeAttribute('data-xm-reading');
      for(const key of ['--xm-reading-text','--xm-reading-muted','--xm-reading-tertiary'])if(root.style.getPropertyValue(key))root.style.removeProperty(key);
    }
  }
  function updateNavTheme(nav){
    // The bottom tab bar keeps X's own background; the glass rail is only for the side navigation.
    let panel=nav?.hasAttribute('data-xm-tabbar')?null:nav?.closest('header[role="banner"]')?.firstElementChild||nav;
    for(let parent=panel&&nav?.parentElement;parent&&parent!==document.body;parent=parent.parentElement){
      if(parent.matches('header[role="banner"]'))break;
      if(['sticky','fixed'].includes(getComputedStyle(parent).position)){panel=parent;break;}
    }
    for(const previous of document.querySelectorAll('[data-xm-nav-panel]'))if(previous!==panel)unmark(previous,'nav-panel');
    mark(panel,'nav-panel');
    for(const account of panel?.querySelectorAll('[data-testid="SideNav_AccountSwitcher_Button"],button[aria-label="Account menu"]')||[]){
      mark(account,'nav-account');mark(account.parentElement,'account-wrap');
      const accountHost=account.parentElement.parentElement;
      if(accountHost!==panel&&panel.contains(accountHost)&&!accountHost.contains(nav))mark(accountHost,'account-host');
      const image=account.querySelector('img'),avatar=image?.closest('.x-avatar,[data-testid^="UserAvatar-Container"]')||image?.parentElement;
      mark(avatar,'account-avatar');
      for(let branch=avatar;branch&&branch!==account;branch=branch.parentElement){
        for(const sibling of branch.parentElement.children)if(sibling!==branch&&(sibling.textContent.trim()||sibling.querySelector('svg')))mark(sibling,'account-detail');
      }
    }
    for(const previous of document.querySelectorAll('[data-xm-nav-stack]'))unmark(previous,'nav-stack');
    for(let parent=panel&&nav?.parentElement;parent&&parent!==panel&&!parent.querySelector('[data-xm-nav-account]');parent=parent.parentElement)mark(parent,'nav-stack');
    const rgb=sampleWallpaper(panel?.getBoundingClientRect());
    const luminance=rgb.map(c=>{const value=c/255;return value<=.04045?value/12.92:((value+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
    const dark=luminance<.179;
    const fill=dark?'15 20 25':'255 255 255';
    const vars={'--xm-nav-rgb':fill,'--xm-nav-fill':`rgb(${fill})`,'--xm-nav-text':dark?'#eff3f4':'#0f1419','--xm-nav-muted':dark?'#b1b8bd':'#4e5962','--xm-nav-hover':dark?'rgb(255 255 255 / .12)':'rgb(0 0 0 / .08)','--xm-nav-opacity':String(settings.sidebarOpacity/100)};
    for(const [key,value] of Object.entries(vars))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
  }
  function navMoreButton(nav){
    return nav.querySelector('[data-testid="AppTabBar_More_Menu"]')||[...nav.querySelectorAll('button[aria-haspopup="menu"],[role="button"][aria-haspopup="menu"]')].find(button=>!button.closest('[data-testid="SideNav_AccountSwitcher_Button"]')&&!button.querySelector('img'));
  }
  const MENU_LAUNCHER_ICON='<path d="M4 7h2M12 7h8M4 17h8M18 17h2"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/>';
  // Adds 「介面設定」 under X's own "Settings and privacy" item by cloning it, so the entry inherits X's menu styling in both UIs.
  function injectMenuLauncher(){
    for(const menu of document.querySelectorAll('[role="menu"]')){
      if(menu.querySelector('[data-xm-menu-launcher]'))continue;
      const link=menu.querySelector('a[href="/settings"],a[href^="/settings/"]');
      const source=link?.closest('[role="menuitem"]')||link;
      if(!source||!menu.contains(source))continue;
      // The old UI wraps the link in its own row; copy that wrapper so the entry becomes a new row instead of sitting beside it.
      let anchor=source;
      while(anchor.parentElement&&anchor.parentElement!==menu&&anchor.parentElement.querySelectorAll('a[href],[role="menuitem"]').length===1)anchor=anchor.parentElement;
      const copy=anchor.cloneNode(true);
      const item=anchor===source?copy:copy.querySelector('a[href="/settings"],a[href^="/settings/"]')?.closest('[role="menuitem"]')||copy.querySelector('a[href="/settings"],a[href^="/settings/"]');
      if(!item)continue;
      for(const element of [copy,...copy.querySelectorAll('*')])for(const name of ['href','id','data-testid','data-highlighted','aria-current','aria-selected'])element.removeAttribute(name);
      item.setAttribute('role','menuitem');item.tabIndex=-1;item.dataset.xmMenuLauncher='';
      const svg=item.querySelector('svg');
      if(svg){
        const icon=document.createElementNS('http://www.w3.org/2000/svg','svg');
        for(const name of ['class','style','width','height'])if(svg.hasAttribute(name))icon.setAttribute(name,svg.getAttribute(name));
        for(const [name,value] of Object.entries({viewBox:'0 0 24 24',fill:'none',stroke:'currentColor','stroke-width':'1.8','stroke-linecap':'round','aria-hidden':'true'}))icon.setAttribute(name,value);
        icon.innerHTML=MENU_LAUNCHER_ICON;svg.replaceWith(icon);
      }
      const texts=[];const walker=document.createTreeWalker(item,NodeFilter.SHOW_TEXT);
      while(walker.nextNode())if(walker.currentNode.data.trim())texts.push(walker.currentNode);
      if(!texts.length)continue;
      texts[0].data='介面設定';for(const text of texts.slice(1))text.data='';
      const highlight=on=>{if(on){for(const other of menu.querySelectorAll('[data-highlighted]'))other.removeAttribute('data-highlighted');item.setAttribute('data-highlighted','');}else item.removeAttribute('data-highlighted');};
      const activate=event=>{
        event.preventDefault();event.stopPropagation();
        menu.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,bubbles:true,cancelable:true}));
        // The new UI closes on Escape; the old UI's dropdown ignores synthetic keys but closes when its trigger is pressed again.
        setTimeout(()=>{if(menu.isConnected)document.querySelector('[aria-haspopup="menu"][aria-expanded="true"]')?.click();openSettings();});
      };
      item.addEventListener('click',activate);
      item.addEventListener('keydown',event=>{
        if(event.key==='Enter'||event.key===' ')activate(event);
        else if(event.key==='ArrowUp'||event.key==='ArrowDown'){
          event.preventDefault();event.stopPropagation();
          const items=[...menu.querySelectorAll('[role="menuitem"]')];
          (event.key==='ArrowUp'?source:items[0])?.focus();
        }
      });
      item.addEventListener('pointerenter',()=>highlight(true));item.addEventListener('pointerleave',()=>highlight(false));
      item.addEventListener('focus',()=>highlight(true));item.addEventListener('blur',()=>highlight(false));
      menu.addEventListener('keydown',event=>{
        if(event.key==='ArrowDown'&&event.target===source&&item.isConnected){event.preventDefault();event.stopPropagation();item.focus();}
      },true);
      anchor.after(copy);
    }
  }
  function moveSettings(target,placement){
    const reopen=dialog.open;
    if(reopen)dialog.close();
    target.append(host);host.dataset.placement=placement;
    if(reopen)dialog.showModal();
  }
  function sidebarModule(heading,sidebar){
    for(let parent=heading.parentElement;parent&&parent!==sidebar;parent=parent.parentElement){
      if(parent.hasAttribute('data-xm-sidebar-module'))return parent;
      const css=getComputedStyle(parent);
      if(parseFloat(css.borderRadius)>=8&&colorRGB(css.backgroundColor)){mark(parent,'sidebar-module');return parent;}
    }
    return null;
  }
  function updateSidebarTheme(sidebar){
    const native=sidebar&&[...sidebar.querySelectorAll('div,section')].filter(e=>!e.closest('[id^="xm-liquid"]'));
    const panel=native?.find(e=>['sticky','fixed'].includes(getComputedStyle(e).position))||native?.find(e=>e.parentElement===sidebar)||null;
    for(const previous of document.querySelectorAll('[data-xm-sidebar-surface]'))if(previous!==panel)unmark(previous,'sidebar-surface');
    mark(panel,'sidebar-surface');
    if(!sidebar)return;
    const dark=luminance(sampleWallpaper(sidebar.getBoundingClientRect()))<.179;
    const vars={'--xm-rail-rgb':dark?'15 20 25':'255 255 255','--xm-rail-text':dark?'#eff3f4':'#0f1419','--xm-rail-muted':dark?'#b1b8bd':'#4e5962','--xm-rail-opacity':String(settings.sidebarOpacity/100)};
    for(const [key,value] of Object.entries(vars))if(sidebar.style.getPropertyValue(key)!==value)sidebar.style.setProperty(key,value);
    const cards=new Set(sidebar.querySelectorAll('section,aside,[style*="background-color"],[data-xm-sidebar-card]'));
    for(const heading of sidebar.querySelectorAll('h2,h3,aside[role="complementary"][aria-label]')){const module=sidebarModule(heading,sidebar);if(module)cards.add(module);}
    for(const element of cards){
      if(!element.closest('button,a,[role="dialog"],[role="menu"],[role="listbox"],[data-slot="xds-popover-content"]')&&(element.matches('aside[role="complementary"][aria-label]')||element.querySelector('h2,h3,aside[role="complementary"][aria-label]')))mark(element,'sidebar-card');else unmark(element,'sidebar-card');
    }
    for(const element of sidebar.querySelectorAll('[style*="color"],[data-xm-rail-color]')){
      if(element.closest('button,[role="button"],[role="dialog"],[role="menu"],[role="listbox"],[data-slot="xds-popover-content"]')){unmark(element,'rail-color');continue;}
      const rgb=colorRGB(element.style.color),key=rgb?.map(Math.round).join(' ');
      const role=['0 0 0','15 20 25','20 23 26','255 255 255','239 243 244','231 233 234'].includes(key)?'primary':['83 100 113','101 119 134','102 102 102','113 118 123','139 152 165','153 153 153','160 166 172','110 118 125','178 178 178'].includes(key)?'secondary':'';
      if(role)mark(element,'rail-color',role);else unmark(element,'rail-color');
    }
  }
  function alignSidebarEdges(primary,nav){
    const panel=nav?.closest('[data-xm-nav-panel]')||document.querySelector('[data-xm-nav-panel]');
    const sidebar=primary?.matches('[data-testid="primaryColumn"]')?document.querySelector('[data-testid="sidebarColumn"]'):primary?.parentElement.querySelector(':scope > aside');
    let moved=false;
    for(const [element,name,active,direction] of [[panel,'edge-nav',settings.enabled&&settings.navAlignLeft&&nav?.getClientRects().length,'left'],[sidebar,'edge-sidebar',settings.enabled&&settings.rightAlignSidebar,'right']]){
      for(const previous of document.querySelectorAll(`[data-xm-${name}]`))if(previous!==element){unmark(previous,name);previous.style.removeProperty('--xm-edge-x');}
      if(!element)continue;
      const previous=parseFloat(element.style.getPropertyValue('--xm-edge-x'))||0;
      if(!active||!element.getClientRects().length){
        if(previous)moved=true;
        unmark(element,name);element.style.removeProperty('--xm-edge-x');continue;
      }
      mark(element,name);
      const rect=element.getBoundingClientRect();
      const shift=direction==='left'?Math.min(0,previous-rect.left):Math.max(0,(document.documentElement.clientWidth||innerWidth)-rect.right+previous);
      const value=Math.round(shift*1000)/1000;
      if(value!==previous){element.style.setProperty('--xm-edge-x',`${value}px`);moved=true;}
    }
    return moved;
  }
  function measureCentering(primary,nav){
    if(!primary)return;
    const legacy=primary.matches('[data-testid="primaryColumn"]');
    const main=primary.closest('main');
    const header=legacy?main?.parentElement.querySelector(':scope > header[role="banner"]'):null;
    const sidebar=legacy?document.querySelector('[data-testid="sidebarColumn"]'):primary.parentElement.querySelector(':scope > aside');
    const navBox=legacy?header?.firstElementChild:primary.parentElement.parentElement.firstElementChild;
    let navWidth=nav?.getClientRects().length?navBox?.getBoundingClientRect().width||nav.getBoundingClientRect().width:0;
    if(navWidth&&header){const css=getComputedStyle(header);navWidth+=['paddingInlineStart','paddingInlineEnd','borderInlineStartWidth','borderInlineEndWidth'].reduce((sum,key)=>sum+(parseFloat(css[key])||0),0);}
    if(navWidth&&compactNavigation())navWidth=72;
    let sideWidth=0;
    if(sidebar&&!settings.hideSidebar&&getComputedStyle(sidebar).display!=='none'){
      const css=getComputedStyle(sidebar);
      sideWidth=legacy?sidebar.getBoundingClientRect().width+(parseFloat(css.marginInlineStart)||0)+(parseFloat(css.marginInlineEnd)||0)+(parseFloat(getComputedStyle(sidebar.parentElement).columnGap)||0):380;
    }
    const rail=Math.max(navWidth,sideWidth);
    const balanced=(document.documentElement.clientWidth||innerWidth)>=settings.width+2*rail||rail===0;
    const vars={'--xm-nav-width':navWidth,'--xm-side-width':sideWidth,'--xm-center-max':settings.width+(balanced?2*rail:navWidth+sideWidth),'--xm-center-pad-start':balanced?Math.max(0,sideWidth-navWidth):0,'--xm-center-pad-end':balanced?Math.max(0,navWidth-sideWidth):0};
    for(const [key,value] of Object.entries(vars))if(root.style.getPropertyValue(key)!==`${value}px`)root.style.setProperty(key,`${value}px`);
    if(legacy&&header){mark(main.parentElement,'old-shell');mark(header,'old-header');mark(primary.parentElement,'old-columns');}
  }
  function refresh() {
    if(!wallpaper.isConnected)document.body.prepend(wallpaper);
    for(const sheet of [style,customStyle])if(!sheet.isConnected)document.head.append(sheet);
    updateTheme();
    const route=location.pathname;
    const home=route==='/home'||route==='/';
    root.dataset.xmHome=String(home);
    for(const element of document.querySelectorAll('[data-xm-home-tabs],[data-xm-composer],[data-xm-feed],[data-xm-suggestion]')){
      for(const name of ['home-tabs','composer','feed','suggestion'])unmark(element,name);
    }
    const utility=/^\/(settings|messages|i\/chat)(\/|$)/.test(route);
    const excluded=utility||/^\/i\/(grok|calls)(\/|$)/.test(route);
    updateUtilityGlass(utility);
    const nav=document.querySelector('nav:has(a[href="/home"]),nav[aria-label="Primary"],header[role="banner"] nav[role="navigation"]');
    mark(nav,'nav');
    const navVisible=nav&&nav.getClientRects().length>0;
    // Narrow windows turn the side navigation into a bottom tab bar; the launcher then joins it as one more tab.
    const tabbar=navVisible&&getComputedStyle(nav).flexDirection.startsWith('row');
    for(const previous of document.querySelectorAll('[data-xm-tabbar]'))if(previous!==nav||!tabbar)unmark(previous,'tabbar');
    if(tabbar)mark(nav,'tabbar');
    // The launcher lives in X's More menu (injectMenuLauncher). A tab bar has no More menu, so it keeps its own tab there.
    // While the navigation is missing (page loading, media viewer) nothing floats over X; the Tampermonkey menu still opens settings.
    const moreButton=navVisible&&!tabbar?navMoreButton(nav):null;
    const placement=!navVisible||moreButton?'menu':tabbar?'tabbar':'nav';
    const parent=placement==='tabbar'||placement==='nav'?nav:document.body;
    if(host.parentElement!==parent)moveSettings(parent,placement);
    else if(host.dataset.placement!==placement)host.dataset.placement=placement;
    injectMenuLauncher();
    updateNavTheme(nav);bindNavigation(nav);
    const primary=excluded?null:document.querySelector('[data-testid="primaryColumn"]')||document.querySelector('main');
    measureCentering(primary,nav);
    for(const old of document.querySelectorAll('[data-xm-primary]'))if(old!==primary)unmark(old,'primary');
    for(const old of document.querySelectorAll('[data-xm-layout],[data-xm-shell],[data-xm-old-shell],[data-xm-old-header],[data-xm-old-columns]')){if(excluded)for(const name of ['layout','shell','old-shell','old-header','old-columns'])unmark(old,name);}
    const nextPaths=new Set(),nextSurfaces=new Set();
    const nextDividers=new Set();
    if(primary){
      mark(primary,'primary');
      const old=primary.hasAttribute('data-testid');
      const grid=primary.parentElement;
      if(!old&&grid.querySelector(':scope > aside')){mark(grid,'layout','new-grid');mark(grid.parentElement,'shell');}
      if(old){const main=primary.closest('main');mark(main,'layout','old-main');}
      let parent=primary.parentElement;
      while(parent&&parent!==document.body){nextPaths.add(parent);parent=parent.parentElement;}
      for(const element of primary.querySelectorAll('[data-testid="cellInnerDiv"], [data-testid="tweet"], [data-testid="primaryColumn"] > div, .bg-primary, [class~="bg-primary/80"]')){
        if(isReadingSurface(element))nextSurfaces.add(element);
      }
      // Legacy React Native wrappers paint the page background inline; media and cards keep theirs.
      for(const element of primary.querySelectorAll('div[style*="background-color"]')){
        if(!isReadingSurface(element))continue;
        const bg=getComputedStyle(element).backgroundColor;
        if(bg.replace(/\s/g,'')===`rgb(${themeRGB.join(',')})`)nextSurfaces.add(element);
      }
      for(const previous of primary.querySelectorAll('[data-xm-header]'))unmark(previous,'header');
      const header=primary.querySelector('[data-page-header]');
      mark(header,'header');
      const tabs=home?primary.querySelector('[role="tablist"]'):null;
      mark(tabs?.parentElement,'home-tabs');
      if(home||/\/status\/\d+\/?$/.test(route)){
        const composer=primary.querySelector(':is([data-testid="tweetTextarea_0"],textarea[aria-multiline="true"]):not(article *,[role="dialog"] *)');
        let container=composer;
        while(container?.parentElement&&container.parentElement!==primary){
          const upper=container.parentElement;
          if(upper.contains(tabs)||upper.matches('[id^="urt:"]')||upper.querySelector('article,[id^="urt:"],[data-testid="cellInnerDiv"]'))break;
          container=upper;
        }
        if(container&&container!==composer&&(home||container.querySelector('[data-testid="tweetButtonInline"]'))){
          mark(container,'composer');nextSurfaces.add(container);
        }
      }
      if(home){
        for(const feed of primary.querySelectorAll('[id^="urt:"],section[role="region"]:has([data-testid="cellInnerDiv"])'))mark(feed,'feed');
        if(settings.enabled&&settings.defaultFollowing&&tabs&&(followedPrimary!==primary||lastRoute!==route)){
          const following=[...tabs.querySelectorAll('[role="tab"]')].find(tab=>tab.dataset.pinnedTimeline==='following'||/^(following|正在跟隨|跟隨中|关注|正在关注|フォロー中)$/i.test(tab.textContent.trim()));
          if(following){followedPrimary=primary;if(following.getAttribute('aria-selected')!=='true')following.click();}
        }
      }
      // Read every computed style first and write the markers afterwards, so the browser lays out once per pass.
      const stickyHeaders=[],walker=document.createTreeWalker(primary,NodeFilter.SHOW_ELEMENT,{acceptNode:node=>
        node.matches('article,[id^="xm-liquid"],[role=dialog],[role=menu],[data-xm-composer],[data-testid="cellInnerDiv"]')?NodeFilter.FILTER_REJECT:node.tagName==='DIV'?NodeFilter.FILTER_ACCEPT:NodeFilter.FILTER_SKIP});
      for(let element=walker.nextNode();element;element=walker.nextNode()){
        if(getComputedStyle(element).position!=='sticky')continue;
        const height=element.getBoundingClientRect().height;
        if(height>0&&height<=180)stickyHeaders.push(element);
      }
      const posts=[];
      for(const article of primary.querySelectorAll('article')){
        const row=article.closest('[data-testid="cellInnerDiv"]')||article.closest('[data-href]')||article;
        let divider=null;
        for(let edge=article;edge&&edge!==primary;edge=edge.parentElement){
          if(edge!==article&&edge.matches('article'))break;
          const css=getComputedStyle(edge);
          if(parseFloat(css.borderRadius)===0&&(parseFloat(css.borderBottomWidth)>0||parseFloat(css.borderTopWidth)>0)){divider=edge;break;}
          if(edge!==article&&[...edge.children].filter(child=>child.matches('article')||child.querySelector('article')).length>1)break;
        }
        const ad=!!(article.closest('[data-testid="placementTracking"]')||article.querySelector('[data-ad-disclosure],[class*="data-ad-disclosure"],a[href*="twclid="]'));
        posts.push([row,divider,ad]);
      }
      for(const element of stickyHeaders)mark(element,'header');
      for(const [row,divider,ad] of posts){
        mark(row,'post');if(divider)nextDividers.add(divider);
        if(ad)mark(row,'ad');else unmark(row,'ad');
      }
    }
    for(const previous of document.querySelectorAll('[data-xm-post-divider]'))if(!nextDividers.has(previous))unmark(previous,'post-divider');
    for(const element of nextDividers)mark(element,'post-divider');
    for(const element of paths)if(!nextPaths.has(element))unmark(element,'path');
    for(const element of nextPaths)mark(element,'path');paths=nextPaths;
    for(const element of surfaces)if(!nextSurfaces.has(element))unmark(element,'surface');
    for(const element of nextSurfaces)mark(element,'surface');surfaces=nextSurfaces;
    const sidebar=document.querySelector('[data-testid="sidebarColumn"]')||document.querySelector('main + aside');mark(sidebar,'sidebar');
    for(const previous of document.querySelectorAll('[data-xm-search-host],[data-xm-search-path],[data-xm-search-list],[data-xm-search-spacer],[data-xm-search-box]'))for(const name of ['search-host','search-path','search-list','search-spacer','search-box'])unmark(previous,name);
    for(const search of sidebar?.querySelectorAll('form[role="search"],[data-testid="SearchBox_Search_Input"]')||[]){
      const form=search.closest('form')||search;
      for(let parent=form.querySelector('input')?.parentElement;parent&&form.contains(parent);parent=parent.parentElement){
        if(parseFloat(getComputedStyle(parent).borderRadius)>=8){mark(parent,'search-fill');break;}
      }
      mark(form.closest('[class~="bg-primary"]')||form,'search');
      if(sidebar.matches('[data-testid="sidebarColumn"]'))for(let parent=form.parentElement;parent&&parent!==sidebar;parent=parent.parentElement){
        if(parent.hasAttribute('data-xm-sidebar-surface'))break;
        if(['fixed','sticky'].includes(getComputedStyle(parent).position)){
          mark(parent,'search-host');
          if(!parent.parentElement.hasAttribute('data-xm-sidebar-surface'))mark(parent.parentElement,'search-list');
          const spacer=parent.nextElementSibling;
          if(spacer&&!spacer.childElementCount&&!spacer.textContent.trim())mark(spacer,'search-spacer');
          break;
        }
        mark(parent,'search-path');
      }
      // The sticky box around the field (and its suggestions) is what stays on screen when the sidebar is hidden.
      // It is found after search-host is marked, since that marker is what keeps the legacy box sticky.
      let box=null;for(let parent=form.parentElement;parent&&parent!==sidebar;parent=parent.parentElement)if(['fixed','sticky'].includes(getComputedStyle(parent).position)){box=parent;break;}
      if(!box){box=form;while(box.parentElement&&box.parentElement!==sidebar&&!box.parentElement.hasAttribute('data-xm-sidebar-surface'))box=box.parentElement;}
      mark(box,'search-box');
    }
    // A hidden sidebar still leaves its search box in the top-right corner while the timeline leaves room for it.
    const timelineEdge=document.querySelector('[data-xm-primary]')?.getBoundingClientRect().right||0,searchRoom=timelineEdge?(document.documentElement.clientWidth||innerWidth)-timelineEdge-48:0;
    const floatingSearch=settings.enabled&&settings.hideSidebar&&!settings.hideSearch&&!!sidebar?.querySelector('[data-xm-search-box]')&&searchRoom>=240;
    if(root.getAttribute('data-xm-floating-search')!==String(floatingSearch))root.setAttribute('data-xm-floating-search',String(floatingSearch));
    const searchWidth=`${Math.round(Math.min(350,searchRoom))}px`;if(floatingSearch&&root.style.getPropertyValue('--xm-floating-search-width')!==searchWidth)root.style.setProperty('--xm-floating-search-width',searchWidth);
    for(const previous of document.querySelectorAll('[data-xm-premium-upsell]'))unmark(previous,'premium-upsell');
    for(const item of sidebar?.querySelectorAll('h2,h3,aside[role="complementary"][aria-label],a[href]')||[]){
      if(!(/premium/i.test(item.getAttribute('aria-label')||item.matches('h2,h3')&&item.textContent||'')||/^\/i\/premium(?:_|\/|$)/.test(xPath(item))))continue;
      const card=sidebarModule(item,sidebar)||item.closest('[data-xm-sidebar-card]');
      if(card&&card!==sidebar)mark(card,'premium-upsell');
    }
    const peoplePage=/\/(followers|following|verified_followers)(\/|$)/.test(route)||route==='/search'||route.startsWith('/i/connect_people');
    for(const suggestion of document.querySelectorAll('[data-testid="topicsToFollow"],a[href^="/i/connect_people"],a[href^="/i/topics/suggested"],a[href*="/i/flow/topics_selector"],a[href*="/i/topics/picker/home"]')){
      if(suggestion.closest('article'))continue;
      const cell=suggestion.closest('[data-testid="cellInnerDiv"]');
      const module=suggestion.closest('aside section,aside [class*="rounded"], [data-testid="sidebarColumn"] aside');
      if(module||home&&!peoplePage)mark(cell||module||suggestion.closest('li[data-index]')||suggestion,'suggestion');
    }
    if(home&&primary)for(const user of primary.querySelectorAll('[data-testid="UserCell"]')){
      if(!user.closest('article'))mark(user.closest('[data-testid="cellInnerDiv"]')||user,'suggestion');
    }
    for(const heading of document.querySelectorAll('h2,h3')){
      if(!/^(who to follow|topics to follow|you might like|推薦跟隨|推薦追蹤|你可能喜歡|你可能會喜歡|你可能感興趣|推荐关注|感兴趣的话题|おすすめユーザー|おすすめトピック)$/i.test(heading.textContent.trim()))continue;
      const module=sidebar?.contains(heading)?sidebarModule(heading,sidebar)||heading.closest('[data-testid="cellInnerDiv"],aside section,aside [class*="rounded"],li[data-index]'):heading.closest('[data-testid="cellInnerDiv"],aside section,aside [class*="rounded"],li[data-index]');
      if(module&&(home||sidebar?.contains(module)))mark(module,'suggestion');
    }
    for(const link of document.querySelectorAll('a[href$="/followers"],a[href$="/verified_followers"],a[href$="/following"]')){
      const count=[...link.querySelectorAll('span,div')].find(e=>/^\s*[\d,.]+\s*[KMB萬万億亿]?\s*$/.test(e.textContent)&&e.children.length===0);mark(count,'follow-count');
    }
    if(nav){
      for(const link of nav.querySelectorAll('a,button,[role="button"]')){
        const outer=link.parentElement.closest('a,button,[role="button"]');if(outer&&nav.contains(outer))continue;
        const href=xPath(link);
        const known=NAV.find(n=>n[2].some(path=>href===path||href.startsWith(path+'/')));
        const legacyList=link.matches('[data-testid="AppTabBar_Lists_Link"]')||/^\/[^/]+\/lists$/.test(href);
        const key=legacyList?'lists':known?.[0]||(link.matches('[data-testid="AppTabBar_Profile_Link"]')||href&&/^\/[^/]+$/.test(href)?'profile':'more');
        mark(link,'nav-hidden',String(settings.navHidden.includes(key)));
        if(!link.hasAttribute('aria-label')&&link.textContent.trim())link.setAttribute('aria-label',link.textContent.trim());
        const inner=link.querySelector(':scope > span,:scope > div');
        let label=inner&&[...inner.children].find(e=>!e.hasAttribute('data-xm-generated-nav-label')&&e.textContent.trim()&&!e.querySelector('svg'));
        const generated=inner?.querySelector('[data-xm-generated-nav-label]');
        if(label)generated?.remove();
        else if(inner&&settings.enabled){
          label=generated||document.createElement('span');
          if(!generated){mark(label,'generated-nav-label');inner.append(label);}
          const text=NAV.find(n=>n[0]===key)?.[1]||link.getAttribute('aria-label')||key;
          if(label.textContent!==text)label.textContent=text;
        }
        if(!settings.enabled)generated?.remove();
        mark(label,'nav-label');
      }
    }
    for(const button of document.querySelectorAll('[data-testid="SideNav_NewTweet_Button"],#sidebar-compose-post,[data-compose-fab]')){
      mark(button,'post-button');
      const panel=button.closest('[data-xm-nav-panel]');if(!panel)continue;
      const wrap=button.parentElement;
      if(wrap!==panel&&!wrap.matches('[data-xm-nav]')&&!wrap.querySelector('[data-xm-nav],[data-xm-nav-account]'))mark(wrap,'post-host');
      const label=[...button.children].find(e=>e.textContent.trim());
      mark(button,'post-icon-only',String(!label));
      if(!button.hasAttribute('aria-label'))button.setAttribute('aria-label',button.textContent.trim()||'發文');
      const ink=getComputedStyle(label||button).color;
      if(button.style.getPropertyValue('--xm-post-ink')!==ink)button.style.setProperty('--xm-post-ink',ink);
    }
    for(const logo of document.querySelectorAll('a:has(svg[data-icon="icon-logo-x"]),header[role="banner"] a[href="/home"]:not([data-testid="AppTabBar_Home_Link"])'))if(!nav?.contains(logo))mark(logo,'logo');
    for(const previous of document.querySelectorAll('[data-xm-grok],[data-xm-chat-dock]')){unmark(previous,'grok');unmark(previous,'chat-dock');}
    for(const icon of document.querySelectorAll('[data-icon*="grok"],use[href*="grok"],path[d^="M12.745 20.54"]')){
      const control=icon.closest('button,a,[role="button"]');if(control&&!nav?.contains(control))markControl(control,'grok');
    }
    for(const control of document.querySelectorAll('[data-testid="GrokButton"],[data-testid="grokButton"],[data-testid="grokImgGen"],button[aria-label*="Grok"],button[aria-label="Explain this post"],button[aria-label="解釋這則貼文"]'))if(!nav?.contains(control))markControl(control,'grok');
    for(const link of document.querySelectorAll('article a[href],[data-testid="tweet"] a[href]'))if(['/i/grok','/i/ai'].includes(xPath(link)))markControl(link,'grok');
    for(const dock of document.querySelectorAll('[data-slot="xds-dock-window"],[data-slot="xds-dock-item"]')){
      const launcher=dock.querySelector('[data-slot="xds-dock-launcher"]');if(!launcher)continue;
      const label=launcher.getAttribute('aria-label')||'';
      if(launcher.querySelector('[data-icon*="grok"],use[href*="grok"]')||/grok/i.test(label))mark(dock,'grok');
      else if(launcher.querySelector('[data-icon^="icon-chat"],use[href^="#icon-chat"]')||/chat|messages|聊天|訊息|消息|チャット|メッセージ/i.test(label))mark(dock,'chat-dock');
    }
    for(const control of document.querySelectorAll('button[aria-label="Chat"],button[aria-label="聊天"],button[aria-label="訊息"]'))if(!control.closest('nav,main'))markControl(control,'chat-dock');
    if(settings.enabled&&settings.hideTitleCount){
      if(document.title!==cleanTitle){originalTitle=document.title;cleanTitle=document.title.replace(/^\(\d+\+?\)\s*/,'');}
      if(cleanTitle!==document.title)document.title=cleanTitle;
    }else if(originalTitle){if(document.title===cleanTitle)document.title=originalTitle;originalTitle='';cleanTitle='';}
    if(alignSidebarEdges(primary,nav))updateNavTheme(nav);
    updateSidebarTheme(sidebar);
    updateReadingTheme(primary);scanVideos();mediaDownloader?.update();liquid?.update(primary);
    for(const effect of sidebarLiquids){
      const panel=document.querySelector(effect.selector);
      // With only the floating search left of the sidebar, the search box draws its own glass instead of the panel.
      effect.controller.update(panel?.getClientRects().length&&!(effect.kind==='right'&&root.getAttribute('data-xm-floating-search')==='true')?panel:null);
      mark(panel,'rail-renderer',sidebarStates.get(effect.kind)?.renderer||'off');
    }
    updateShareMenu();updateInterfaceGlass();magneticCursor?.update();lastRoute=route;
  }

  let themeRGB=[255,255,255];
  function updateTheme() {
    const html=getComputedStyle(root);
    const theme=root.getAttribute('data-theme');
    let bg=html.getPropertyValue('--x-bg-primary').trim()||document.body.style.backgroundColor||html.getPropertyValue('--body-bg-color').trim()||initialBackground;
    if(!bg||bg==='transparent'||bg==='rgba(0, 0, 0, 0)')bg=theme==='dark'?'rgb(0,0,0)':'rgb(255,255,255)';
    let rgb;
    if(bg.startsWith('#')){let hex=bg.slice(1);if(hex.length===3||hex.length===4)hex=[...hex].map(c=>c+c).join('');rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));}
    else rgb=bg.match(/[\d.]+/g)?.slice(0,3).map(Number);
    if(!rgb||rgb.length!==3||rgb.some(n=>!Number.isFinite(n)))rgb=theme==='dark'?[0,0,0]:[255,255,255];
    themeRGB=rgb;
    const dark=(rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722)<128;
    const vars={'--xm-rgb':rgb.join(' '),'--xm-panel':`rgb(${rgb.join(' ')})`,'--xm-text':dark?'#eff3f4':'#0f1419','--xm-muted':dark?'#a0a6ac':'#59636b','--xm-line':dark?'#34383c':'#d8dde0','--xm-hover':dark?'#24272b':'#f1f3f4','--xm-error':dark?'#ff9d9d':'#bb2626','--xm-scheme':dark?'dark':'light'};
    for(const [key,value] of Object.entries(vars))if(root.style.getPropertyValue(key)!==value)root.style.setProperty(key,value);
  }
  let scheduled=false;
  // Text that changes inside posts (relative times, counters, video clocks) never changes the layout this script manages.
  const quietText=record=>record.type==='characterData'&&!!record.target.parentElement?.closest('article,time,[data-testid="videoPlayer"],[data-testid="videoComponent"],[role="slider"]');
  function schedule(records=[]) {
    if(Array.isArray(records)&&records.length){records=records.filter(record=>!quietText(record));if(!records.length)return;}
    if(records.length&&records.every(record=>record.target===host||record.target===wallpaper||record.target===style||record.target===customStyle))return;
    const pageAdded=Array.isArray(records)&&records.some(record=>record.type==='childList'&&[...record.addedNodes].some(node=>node instanceof Element&&(node.matches('main,[data-testid="primaryColumn"],[data-testid="xchatEmbedRoute"],[data-page-header],[role="tablist"],[data-testid="tweetTextarea_0"],form[role="search"],input[role="combobox"],[data-testid="sidebarColumn"]')||node.querySelector('main,[data-testid="primaryColumn"],[data-testid="xchatEmbedRoute"],[data-page-header],[role="tablist"],[data-testid="tweetTextarea_0"],form[role="search"],input[role="combobox"],[data-testid="sidebarColumn"]'))));
    if(location.pathname!==lastRoute||pageAdded){refresh();return;}
    if(scheduled)return;scheduled=true;
    setTimeout(()=>{scheduled=false;refresh();},80);
  }
  // Observe X's changing content, not the attributes this script writes itself.
  new MutationObserver(records=>{
    if(records.some(record=>record.attributeName==='aria-expanded'&&record.target.matches('article [aria-haspopup="menu"]')))updateShareMenu();
    // Apply popup material in the mutation microtask, before its first paint.
    if(records.some(record=>record.type==='attributes'?record.target.matches(INTERFACE_GLASS):[...record.addedNodes].some(node=>node instanceof Element&&(node.matches(INTERFACE_GLASS)||node.querySelector(INTERFACE_GLASS))))){
      updateShareMenu();updateInterfaceGlass();
    }
    schedule(records);
  }).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['data-open','hidden','aria-hidden','aria-expanded']});
  new MutationObserver(records=>{
    // X hydration replaces the root attributes after document-end.
    if(root.dataset.xmEnabled!==String(settings.enabled)||root.style.getPropertyValue('--xm-width')!==`${settings.width}px`)apply();
    schedule(records);
  }).observe(root,{attributes:true,attributeFilter:['data-theme','class','style','data-xm-enabled']});
  new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['style','class']});
  new MutationObserver(schedule).observe(document.head,{childList:true,characterData:true,subtree:true});
  window.addEventListener('popstate',schedule);
  window.addEventListener('pageshow',schedule);
  window.addEventListener('resize',schedule);
  document.addEventListener('load',event=>{if(event.target instanceof HTMLImageElement&&event.target.src.includes('pbs.twimg.com/'))schedule();},true);
  if(typeof GM_registerMenuCommand==='function')GM_registerMenuCommand('X 極簡設定',openSettings);
  if(typeof GM_addValueChangeListener==='function'){
    GM_addValueChangeListener(KEY,(_key,_old,value,remote)=>{if(remote){imageRequest++;const next=normalize(value),reset=next.liquidTier!==settings.liquidTier,resetSidebar=next.sidebarTier!==settings.sidebarTier;settings=next;if(reset)liquid?.resetPerformance();if(resetSidebar){for(const effect of sidebarLiquids)effect.controller.resetPerformance();for(const record of interfaceGlass.values())record.controller.resetPerformance();}apply();refresh();updateVideoAudio();syncUI();}});
    GM_addValueChangeListener(SYNC_META_KEY,(_key,_old,value,remote)=>{if(remote){for(const [key,stamp] of Object.entries(value?.fields||{})){const old=syncMeta.fields[key];if([...Object.keys(DEFAULTS),'videoVolume'].includes(key)&&Number.isSafeInteger(stamp?.at)&&stamp.at>=0&&typeof stamp.device==='string'&&/^[-\w]{0,80}$/.test(stamp.device)&&(!old||stamp.at>old.at||stamp.at===old.at&&stamp.device>old.device))syncMeta.fields[key]={at:stamp.at,device:stamp.device};}syncController?.changed();}});
    GM_addValueChangeListener(SYNC_CONFIG_KEY,(_key,_old,_value,remote)=>{if(remote){const old=syncConfig;syncConfig=loadSyncConfig();syncMessage='';syncConnectionUI();if(old.provider!==syncConfig.provider||old.auto!==syncConfig.auto||JSON.stringify(old[old.provider])!==JSON.stringify(syncConfig[syncConfig.provider]))syncController?.changed();}});
    GM_addValueChangeListener(DOWNLOAD_KEY,(_key,_old,value,remote)=>{if(remote){const merged=mergeDownloadHistory(downloadHistory,value);downloadHistory=merged;try{if(JSON.stringify(merged)!==JSON.stringify(normalizeDownloadHistory(value)))GM_setValue(DOWNLOAD_KEY,merged);}catch{}syncDownloadHistoryUI();mediaDownloader?.update();}});
    GM_addValueChangeListener(DOWNLOAD_DELETED_KEY,(_key,_old,value,remote)=>{if(remote){downloadDeleted=mergeDownloadDeleted(downloadDeleted,value);downloadHistory=pruneDownloadHistory(downloadHistory,downloadDeleted);syncDownloadHistoryUI();mediaDownloader?.update();}});
    GM_addValueChangeListener(AUDIO_KEY,(_key,_old,value,remote)=>{if(remote&&(value===null||validVolume(value))){videoVolume=value;updateVideoAudio();syncVideoVolume();}});
  }
  // Liquid Glass shaders adapted from TW527E/tw527e.zip, MIT, Copyright (c) 2026 TW527E.
  /*
   * MIT License
   *
   * Copyright (c) 2026 X Minimal contributors
   * Copyright (c) 2026 TW527E
   * Copyright (c) 2026 Shohei Ohtaki
   * Copyright © 2024 - 2025 ChinaGodMan & molanp,Inc
   *
   * Permission is hereby granted, free of charge, to any person obtaining a copy
   * of this software and associated documentation files (the "Software"), to deal
   * in the Software without restriction, including without limitation the rights
   * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   * copies of the Software, and to permit persons to whom the Software is
   * furnished to do so, subject to the following conditions:
   *
   * The above copyright notice and this permission notice shall be included in all
   * copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   * SOFTWARE.
   */
  // Cursor adapted from TW527E/tw527e.zip, MIT, Copyright (c) 2026 TW527E.
  function createMagneticCursor(getEnabled) {
    const fine=matchMedia('(hover: hover) and (pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),contrast=matchMedia('(forced-colors: active)');
    const INTERACTIVE='a[href],button,[role="button"],[role="link"],[role="slider"],[role="menuitem"],[role="menuitemcheckbox"],[role="menuitemradio"],[role="option"],[role="tab"],[role="checkbox"],[role="radio"],[role="switch"],input:is([type="range"],[type="checkbox"],[type="radio"],[type="button"],[type="submit"]),select,summary,label,[data-cursor]';
    const TEXT_FIELD='input:is([type="text"],[type="search"],[type="email"],[type="url"],[type="password"],[type="tel"],[type="number"],:not([type])):not(:disabled),textarea:not(:disabled),[contenteditable="true"],[role="textbox"]';
    const css=`#xm-cursor-ring{position:fixed;top:0;left:0;z-index:2147483647;width:22px;height:22px;border-radius:50%;background:rgb(255 255 255 / .1);box-shadow:inset 0 0 0 1px rgb(255 255 255 / .12),0 2px 10px rgb(0 0 0 / .08);backdrop-filter:blur(3px) saturate(1.6) brightness(1.05);-webkit-backdrop-filter:blur(3px) saturate(1.6) brightness(1.05);opacity:0;pointer-events:none!important;will-change:transform;transition:opacity .15s,background-color .2s,box-shadow .2s;--xm-cursor-snap:rgb(20 22 28 / .12);--xm-cursor-wide:rgb(20 22 28 / .05);--xm-cursor-beam:rgb(20 22 28 / .6);--xm-cursor-edge:rgb(255 255 255 / .55)}#xm-cursor-ring[data-theme="dark"]{--xm-cursor-snap:rgb(255 255 255 / .18);--xm-cursor-wide:rgb(255 255 255 / .07);--xm-cursor-beam:rgb(255 255 255 / .65);--xm-cursor-edge:rgb(255 255 255 / .35)}#xm-cursor-ring.is-visible{opacity:1}#xm-cursor-ring::after{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,rgb(255 255 255 / .2),transparent 48%);opacity:0;pointer-events:none}#xm-cursor-ring.is-snapped{background:var(--xm-cursor-snap);box-shadow:inset 0 1px 0 var(--xm-cursor-edge),inset 0 -1px 1px rgb(0 0 0 / .06),inset 1px 0 0 rgb(255 120 160 / .18),inset -1px 0 0 rgb(110 170 255 / .18),inset 0 0 0 1px rgb(255 255 255 / .12),0 6px 18px rgb(0 0 0 / .14);backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}#xm-cursor-ring.is-snapped::after{opacity:1}#xm-cursor-ring.is-snapped.is-wide{background:var(--xm-cursor-wide);box-shadow:inset 0 1px 0 var(--xm-cursor-edge),inset 0 0 0 1px rgb(255 255 255 / .12)}#xm-cursor-ring.is-snapped.is-wide::after{opacity:.5}#xm-cursor-ring.is-text{background:var(--xm-cursor-beam);box-shadow:none;backdrop-filter:blur(0);-webkit-backdrop-filter:blur(0)}`;
    const style=document.createElement('style');style.textContent=css+'#xm-cursor-ring{margin:0;padding:0;border:0;overflow:visible;right:auto;bottom:auto}#xm-cursor-ring::backdrop{display:none!important;pointer-events:none!important}#xm-cursor-ring.is-snapped.is-nav{background:transparent;box-shadow:inset 0 1px 0 var(--xm-cursor-edge),inset 0 0 0 1px rgb(255 255 255 / .12)}';document.head.append(style);
    const ring=document.createElement('div');ring.id='xm-cursor-ring';ring.setAttribute('aria-hidden','true');document.body.append(ring);
    const shadowStyles=new Map(),abort=new AbortController(),options={passive:true,signal:abort.signal};
    const topLayer=typeof ring.showPopover==='function';if(topLayer)ring.setAttribute('popover','manual');
    let enabled=false,disposed=false,px=-100,py=-100,target=null,hovered=null,overlay=null,beam=null,down=false,radius=0,pad=5,raf=0,scrollPick=0,drawn=false,lastTick=0;
    const cur={x:px,y:py,w:22,h:22,r:11,s:1},radii=new WeakMap();
    function mount(hit){
      const dialog=hit?.closest('dialog[open],[popover]:popover-open'),destination=dialog||document.body;
      if(topLayer){if(!ring.matches(':popover-open')||overlay!==dialog){if(ring.matches(':popover-open'))ring.hidePopover();ring.showPopover();}overlay=dialog;return;}
      if(ring.parentElement===destination)return;
      const root=destination.getRootNode();
      if(root instanceof ShadowRoot&&!shadowStyles.has(root)){const copy=style.cloneNode(true);root.append(copy);shadowStyles.set(root,copy);}
      destination.append(ring);
    }
    function hide(){ring.classList.remove('is-visible','is-snapped','is-wide','is-nav','is-text','is-slider');if(topLayer&&ring.matches(':popover-open'))ring.hidePopover();cancelAnimationFrame(raf);cancelAnimationFrame(scrollPick);raf=scrollPick=0;target=hovered=beam=null;drawn=false;}
    function update(){
      if(!disposed){if(!ring.isConnected)document.body.append(ring);if(!style.isConnected)document.head.append(style);}
      enabled=!disposed&&!!getEnabled()&&fine.matches&&!reduce.matches&&!contrast.matches;
      if(!enabled||target&&!target.isConnected)hide();
    }
    function sliderGeometry(slider){
      const box=slider.getBoundingClientRect(),parent=slider.parentElement?.getBoundingClientRect();
      // Legacy X puts the slider role on a 32px thumb inside a thin rail.
      if(box.width<=64&&box.height<=64&&parent&&parent.width>0&&parent.height>0){
        if(parent.height<=12&&parent.width>box.width*1.5)return {rect:parent,vertical:false,legacy:true};
        if(parent.width<=12&&parent.height>box.height*1.5)return {rect:parent,vertical:true,legacy:true};
      }
      const vertical=slider.getAttribute('aria-orientation')==='vertical'||box.height>box.width;
      const rect=[...slider.children].map(e=>e.getBoundingClientRect()).find(r=>r.width>0&&r.height>0&&(vertical?r.width<=12&&r.height>=box.height*.7:r.height<=12&&r.width>=box.width*.7))||box;
      return {rect,vertical,legacy:false};
    }
    function legacySliderAt(element,frame){
      for(let branch=element,depth=0;branch&&branch!==frame&&depth<4;branch=branch.parentElement,depth++)for(const slider of branch.querySelectorAll('[role="slider"]')){
        const {rect,vertical,legacy}=sliderGeometry(slider);
        if(legacy&&px>=rect.left-(vertical?12:0)&&px<=rect.right+(vertical?12:0)&&py>=rect.top-(vertical?0:12)&&py<=rect.bottom+(vertical?0:12))return slider;
      }
      return null;
    }
    function goal(){
      const s=down?0.94:1;
      if(!target)return beam?{x:px,y:beam.y,w:3,h:beam.h,r:1.5,s}:{x:px,y:py,w:22,h:22,r:11,s};
      const rect=target.getBoundingClientRect();
      if(target.matches('[role="slider"],input[type="range"]')){
        const {rect:rail,vertical}=sliderGeometry(target);
        const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),size=down?18:14,cross=down?26:22;
        return vertical?{x:rail.x+rail.width/2,y:clamp(py,rail.top,rail.bottom),w:cross,h:size,r:7,s:1}:{x:clamp(px,rail.left,rail.right),y:rail.y+rail.height/2,w:size,h:cross,r:7,s:1};
      }
      const cx=rect.x+rect.width/2,cy=rect.y+rect.height/2;
      const shift=d=>Math.max(-8,Math.min(8,d*.2));
      return {x:cx+shift(px-cx),y:cy+shift(py-cy),w:rect.width+pad*2,h:rect.height+pad*2,r:Math.min(radius+pad,(rect.height+pad*2)/2,(rect.width+pad*2)/2),s};
    }
    const following=()=>!target&&Math.abs(cur.w-(beam?3:22))<.5&&Math.abs(cur.h-(beam?beam.h:22))<.5;
    function place(){ring.style.transform=`translate3d(${cur.x-cur.w/2}px,${cur.y-cur.h/2}px,0) scale(${cur.s})`;}
    function tick(now){
      raf=0;if(!enabled)return;
      const blend=1-Math.pow(.72,Math.min(100,Math.max(1,now-lastTick))/(1000/60));lastTick=now;
      if(target&&!target.isConnected){hide();return;}
      const g=goal();let moving=false;
      if(following()){cur.x=g.x;if(!beam)cur.y=g.y;}
      for(const key of ['x','y','w','h','r','s']){const d=g[key]-cur[key];if(Math.abs(d)>(key==='s'?.001:.1)){cur[key]+=d*blend;moving=true;}else cur[key]=g[key];}
      if(moving||!drawn){drawn=!moving;ring.style.width=`${cur.w}px`;ring.style.height=`${cur.h}px`;ring.style.borderRadius=`${cur.r}px`;place();}
      if(moving)raf=requestAnimationFrame(tick);
    }
    function kick(){if(enabled&&!raf){lastTick=performance.now();raf=requestAnimationFrame(tick);}}
    function textLine(x,y,hit){
      const root=hit?.getRootNode(),node=document.caretPositionFromPoint?.(x,y,root instanceof ShadowRoot?{shadowRoots:[root]}:undefined)?.offsetNode??document.caretRangeFromPoint?.(x,y)?.startContainer;
      if(!(node instanceof Text)||!node.data.trim())return null;
      const range=document.createRange();range.selectNodeContents(node);
      const height=parseFloat(getComputedStyle(node.parentElement||document.body).lineHeight);
      for(const r of range.getClientRects()){const gap=Number.isNaN(height)?2:Math.max((height-r.height)/2,0)+1;if(x>=r.left-2&&x<=r.right+2&&y>=r.top-gap&&y<=r.bottom+gap)return {y:r.top+r.height/2,h:r.height};}
      return null;
    }
    function pick(el){
      mount(el);
      const field=el?.closest(TEXT_FIELD);
      let hit=down&&target?.matches('[role="slider"],input[type="range"]')?target:field?null:el?.closest(INTERACTIVE);
      const videoFrame=el?.closest('[data-xm-video-frame],[data-testid="videoPlayer"],[data-testid="videoComponent"]');
      if(videoFrame&&!down&&!hit?.matches('[role="slider"],input[type="range"]'))hit=legacySliderAt(el,videoFrame)||hit;
      if(hit&&((hit.closest(':disabled,[aria-disabled="true"],[data-disabled]')||hit.matches('article'))||hit.querySelector('article')))hit=null;
      if(hit&&videoFrame){
        const r=hit.getBoundingClientRect(),frame=videoFrame.getBoundingClientRect();
        const control=hit.matches('button,[role="button"],[role="slider"],input[type="range"]');
        const slider=hit.matches('[role="slider"],input[type="range"]')?sliderGeometry(hit):null,edge=frame.bottom-Math.min(80,frame.height/3);
        const bottom=!!hit.closest('[class~="group/controls"],[data-testid="videoControls"],[data-testid="videoPlayerControls"]')||r.top>=edge||slider?.vertical&&slider.rect.bottom>=edge&&slider.rect.top>=frame.top;
        if(!control||!bottom||!slider&&r.height>64||r.width>=frame.width*.85&&r.height>=frame.height*.75)hit=null;
      }
      const rect=field?.getBoundingClientRect();
      beam=field?{y:field.matches('textarea,[contenteditable="true"],[role="textbox"]')?py:rect.y+rect.height/2,h:(parseFloat(getComputedStyle(field).fontSize)||16)*1.25}:hit||videoFrame?null:textLine(px,py,el);
      ring.classList.toggle('is-text',!!beam);
      const rgb=el&&getComputedStyle(el).color.match(/[\d.]+/g)?.slice(0,3).map(Number);
      ring.dataset.theme=rgb&&rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722>140?'dark':'light';
      if(hit===hovered)return;
      hovered=hit||null;target=hit?.closest('[data-xm-nav]')?hit.querySelector(':scope > .outline-focus,:scope > div,:scope > span')||hit:hit||null;drawn=false;ring.classList.remove('is-snapped','is-wide','is-nav','is-slider');
      if(!hit)return;
      const box=target.getBoundingClientRect(),wide=box.height>72;
      pad=wide?3:5;
      if(!radii.has(target))radii.set(target,Math.max(parseFloat(getComputedStyle(target).borderTopLeftRadius)||0,8));
      radius=radii.get(target);ring.classList.toggle('is-slider',target.matches('[role="slider"],input[type="range"]'));ring.classList.add('is-snapped');ring.classList.toggle('is-wide',wide);ring.classList.toggle('is-nav',!!hit.closest('[data-xm-nav]'));
    }
    function hitAtPoint(){let el=document.elementFromPoint(px,py),next;while(el?.shadowRoot&&(next=el.shadowRoot.elementFromPoint(px,py))&&next!==el)el=next;return el;}
    function move(e){
      if(!enabled||e.pointerType!=='mouse')return;
      px=e.clientX;py=e.clientY;
      if(down&&!getSelection()?.isCollapsed){hide();return;}
      if(!ring.classList.contains('is-visible')){cur.x=px;cur.y=py;ring.classList.add('is-visible');}
      pick(e.composedPath().find(node=>node instanceof Element)||null);
      if(following()){cur.x=px;if(!beam)cur.y=py;place();}
      kick();
    }
    function repick(){if(!enabled||scrollPick)return;scrollPick=requestAnimationFrame(()=>{scrollPick=0;pick(hitAtPoint());drawn=false;kick();});}
    window.addEventListener('pointermove',move,{...options,capture:true});
    window.addEventListener('scroll',repick,{...options,capture:true});window.addEventListener('resize',repick,options);
    window.addEventListener('pointerdown',()=>{down=true;kick();},{...options,capture:true});
    window.addEventListener('pointerup',()=>{down=false;kick();},{...options,capture:true});
    window.addEventListener('blur',hide,options);document.documentElement.addEventListener('pointerleave',hide,options);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();},options);
    for(const preference of [fine,reduce,contrast])preference.addEventListener('change',update);
    update();
    return {update,dispose(){disposed=true;hide();abort.abort();for(const preference of [fine,reduce,contrast])preference.removeEventListener('change',update);for(const copy of shadowStyles.values())copy.remove();style.remove();ring.remove();}};
  }

  function createLiquidGlass(getSettings,getImage,getThemeRGB,onState,options={}){
    const layerId=options.id||'xm-liquid',INSET=options.inset||0,RADIUS=options.radius??28;
    const BAND=48,STRENGTH=64,CHROMA=.3,EDGE=.7,SPECULAR=.7,SPECULAR_WIDTH=1.5,LIGHT_ANGLE=-120,CURVATURE=3,IOR=1.5,SATURATE=1.8;
    const VERT=`
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
  `;
    const RIM=`
  precision highp float;
  uniform sampler2D uSharp;
  uniform sampler2D uBlur;
  uniform vec2 uClipOffset;
  uniform vec2 uCanvas;   // 畫布像素
  uniform float uDpr;
  uniform vec2 uSize;     // 卡片大小（CSS px）
  uniform float uRadius;
  uniform vec2 uOrigin;   // 卡片左上角在畫面上的位置
  uniform vec3 uU;        // 畫面座標 → 背景圖座標
  uniform vec3 uV;
  uniform vec3 uPage;     // 圖片還沒出來時的底色
  uniform vec4 uScrim;    // 背景上的遮罩（a 已乘上透明度）
  uniform float uImgAlpha;
  uniform float uOpaque;  // 1 = 中間也畫（霧面那層還沒對齊的時候）
  uniform float uBand;
  uniform float uStrength;
  uniform float uChroma;
  uniform float uEdge;
  uniform float uSpec;
  uniform vec2 uLight;

  const float K = ${CURVATURE.toFixed(1)};
  const float IOR = ${IOR.toFixed(3)};
  const float SAT = ${SATURATE.toFixed(2)};

  vec2 toUv(vec2 p) { vec3 h = vec3(p, 1.0); return vec2(dot(uU, h), dot(uV, h)); }

  vec3 saturate(vec3 c) {
    float lum = dot(c, vec3(0.213, 0.715, 0.072));
    return lum + (c - lum) * SAT;
  }

  // 邊緣往內 t（0 = 最外圈、1 = 折射帶內側）的位置光線偏多少，最外圈 = 1
  float bend(float t) {
    t = clamp(t, 0.0, 0.9999);
    float a = pow(1.0 - t, K);
    float slope = pow(1.0 - t, K - 1.0) * pow(max(1.0 - a, 1e-6), 1.0 / K - 1.0);
    float theta = atan(slope);
    float b = tan(theta - asin(sin(theta) / IOR));
    float top = tan(1.5707963 - asin(1.0 / IOR));
    return clamp(b / top, 0.0, 1.0);
  }

  void main() {
    vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y) / uDpr + uClipOffset;
    vec2 c = p - uSize * 0.5;
    vec2 q = abs(c) - (uSize * 0.5 - uRadius);
    vec2 o = max(q, 0.0);
    float outside = length(o);
    float depth = -(outside + min(max(q.x, q.y), 0.0) - uRadius);
    // 折射帶裡面霧面那層會畫，這裡不用畫
    float alpha = max(uOpaque, 1.0 - smoothstep(uBand - 6.0, uBand, depth));
    if (alpha <= 0.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    vec2 n = outside > 0.0 ? o / outside : (q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0));
    n *= vec2(c.x < 0.0 ? -1.0 : 1.0, c.y < 0.0 ? -1.0 : 1.0);

    float k = depth < uBand ? bend(depth / uBand) : 0.0;
    vec2 at = uOrigin + p;
    vec2 shift = n * k * uStrength;
    // 越靠邊越清楚
    float frost = mix(1.0 - uEdge, 1.0, smoothstep(0.0, uBand, depth));
    vec3 col = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      vec2 uv = toUv(at - shift * (1.0 + uChroma * float(i) * 0.5));
      vec3 s = mix(saturate(texture2D(uSharp, uv).rgb), texture2D(uBlur, uv).rgb, frost);
      if (i == 0) col.r = s.r; else if (i == 1) col.g = s.g; else col.b = s.b;
    }
    col = mix(uPage, col, uImgAlpha);
    col = mix(col, uScrim.rgb, uScrim.a);

    float d = max(depth, 0.0);
    float crisp = max(0.0, 1.0 - d / ${SPECULAR_WIDTH.toFixed(2)});
    float glow = max(0.0, 1.0 - d / ${(SPECULAR_WIDTH * 5).toFixed(2)});
    float rim = uSpec * (crisp * crisp + 0.3 * glow * glow);
    float facing = dot(n, uLight);
    float shade = 0.12 + 0.88 * (facing > 0.0 ? facing : -0.4 * facing);
    col += min(1.0, rim * shade);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0) * alpha, alpha);
  }
  `;
    const GAUSS=`
  precision highp float;
  uniform sampler2D uSrc;
  uniform vec2 uSize;
  uniform vec2 uDir;
  uniform float uSigma;
  uniform float uSat;
  uniform float uFlip;
  void main() {
    vec2 uv = gl_FragCoord.xy / uSize;
    if (uFlip > 0.5) uv.y = 1.0 - uv.y;
    vec4 sum = vec4(0.0);
    float total = 0.0;
    for (int i = -24; i <= 24; i++) {
      float x = float(i);
      if (abs(x) > uSigma * 3.0) continue;
      float w = exp(-x * x / (2.0 * uSigma * uSigma));
      sum += texture2D(uSrc, uv + uDir * x / uSize) * w;
      total += w;
    }
    vec3 c = sum.rgb / total;
    float lum = dot(c, vec3(0.213, 0.715, 0.072));
    gl_FragColor = vec4(lum + (c - lum) * uSat, 1.0);
  }
  `;
    const PERF_KEY=options.performanceKey||(layerId==='xm-liquid'?'x-minimal-liquid-performance':`${layerId}-performance`),REMEMBER=5*3600000;
    const query=value=>typeof matchMedia==='function'?matchMedia(value):{matches:false,addEventListener(){},removeEventListener(){}};
    const reduce=query('(prefers-reduced-transparency: reduce)'),contrast=query('(forced-colors: active)'),touch=query('(pointer: coarse)');
    const chromium=!!navigator.userAgentData?.brands?.some(b=>b.brand==='Chromium')||/Chrom(?:e|ium)\//.test(navigator.userAgent);
    let level=0;
    try{const saved=GM_getValue(PERF_KEY,null);if(saved&&Date.now()-saved.at<REMEMBER)level=Math.min(2,Math.max(0,Number(saved.level)||0));}catch{}
    let target=null,layer=null,style=null,canvas=null,gl=null,rim=null,gauss=null,quad=null,sharp=null,blurred=null;
    let framebuffer=null,sourceImage=null,sourceKey='',paintKey='',blocked='',blockedImage=null,lastState='',disposed=false;
    let raf=0,scrollTimer=0,activeUntil=0,lastFrame=0,best=1000/60,strikes=0,samples=[],rimHidden=false,paintEdges='';
    const uniforms=new Map();
    function emit(renderer,reason=''){
      const reasons={'not-visible':'此區域目前不在畫面內','context-lost':'WebGL 內容已中斷，暫用毛玻璃','reduced-transparency':'依系統減少透明度','forced-colors':'依系統高對比配色','backdrop-unavailable':'瀏覽器不支援背景模糊，使用實色','manual-lite':'第二層：只保留模糊','performance-lite':'效能自動降級到第二層','manual-move':'第一層：移動時隱藏折射邊','performance-move':'效能自動降級到第一層','image-unavailable':'背景圖片暫不可取樣，使用毛玻璃','image-security':'圖片未提供跨來源存取，使用毛玻璃','webgl-unavailable':'WebGL 暫不可用，使用毛玻璃'};
      const state={renderer,reason:reasons[reason]||(reason?'WebGL 暫不可用，使用毛玻璃':''),fade:hidesOnMove(getSettings())};
      const key=JSON.stringify(state);if(key!==lastState){lastState=key;onState(state);}
    }
    function ensureLayer(){
      if(layer){const root=options.local&&target?.getRootNode(),destination=root instanceof ShadowRoot?root:document.head;if(style.parentNode!==destination)destination.append(style);if(options.local&&target){if(layer.parentElement!==target)target.prepend(layer);}else if(!layer.isConnected){const wallpaper=document.getElementById('xm-wallpaper');if(wallpaper)wallpaper.after(layer);else document.body.prepend(layer);}return;}
      style=document.createElement('style');style.id=`${layerId}-style`;
      style.textContent=`#${layerId}{position:fixed;z-index:-1;pointer-events:none;overflow:hidden;isolation:isolate}#${layerId}>canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none;transition:opacity .12s linear}@media(prefers-reduced-motion:reduce){#${layerId}>canvas{transition:none}}`;
      const root=options.local&&target?.getRootNode(),destination=root instanceof ShadowRoot?root:document.head;destination.append(style);layer=document.createElement('div');layer.id=layerId;layer.style.zIndex=String(Number.isFinite(options.zIndex)?options.zIndex:-1);layer.setAttribute('aria-hidden','true');
      if(options.local){layer.style.position='absolute';target.prepend(layer);return;}
      const wallpaper=document.getElementById('xm-wallpaper');if(wallpaper)wallpaper.after(layer);else document.body.prepend(layer);
    }
    function canBlur(){return typeof CSS!=='undefined'&&typeof CSS.supports==='function'&&(CSS.supports('backdrop-filter','blur(1px)')||CSS.supports('-webkit-backdrop-filter','blur(1px)'));}
    function shader(fragment){
      const program=gl.createProgram(),shaders=[];
      try{
        for(const [type,source] of [[gl.VERTEX_SHADER,VERT],[gl.FRAGMENT_SHADER,fragment]]){
          const part=gl.createShader(type);shaders.push(part);gl.shaderSource(part,source);gl.compileShader(part);
          if(!gl.getShaderParameter(part,gl.COMPILE_STATUS))throw new Error('shader-compile');gl.attachShader(program,part);
        }
        gl.bindAttribLocation(program,0,'aPos');gl.linkProgram(program);
        if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error('shader-link');return program;
      }catch(error){gl.deleteProgram(program);throw error;}finally{for(const part of shaders)gl.deleteShader(part);}
    }
    function release(){
      if(gl){
        for(const texture of [sharp,blurred])if(texture)gl.deleteTexture(texture);
        if(framebuffer)gl.deleteFramebuffer(framebuffer);if(quad)gl.deleteBuffer(quad);
        if(rim)gl.deleteProgram(rim);if(gauss)gl.deleteProgram(gauss);
        if(canvas){canvas.removeEventListener('webglcontextlost',lost);canvas.removeEventListener('webglcontextrestored',restored);}
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      }
      canvas?.remove();canvas=null;gl=null;rim=null;gauss=null;quad=null;sharp=null;blurred=null;framebuffer=null;
      uniforms.clear();sourceImage=null;sourceKey='';paintKey='';
    }
    function lost(event){
      event.preventDefault();blocked='context-lost';paintKey='';if(canvas)canvas.style.display='none';
      if(layer){emit(canBlur()?'blur':'solid','context-lost');}
    }
    function restored(){blocked='';release();schedule();}
    function prepareGL(){
      if(gl&&gl.isContextLost())release();
      if(gl&&!gl.isContextLost())return;
      canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');
      gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true});
      if(!gl){canvas=null;throw new Error('webgl-unavailable');}
      canvas.addEventListener('webglcontextlost',lost);canvas.addEventListener('webglcontextrestored',restored);
      rim=shader(RIM);gauss=shader(GAUSS);quad=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,quad);
      gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
      gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);framebuffer=gl.createFramebuffer();layer.append(canvas);
    }
    function texture(source,width=0,height=0){
      const result=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,result);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      try{if(source)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);else gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
        if(gl.getError()!==gl.NO_ERROR)throw new Error('texture-upload');return result;
      }catch(error){gl.deleteTexture(result);throw error;}
    }
    function prepareSource(image,s,theme){
      const key=[innerWidth,innerHeight,s.blur,s.backgroundDim,s.backgroundFit,s.backgroundPosition,theme.join(',')].join('|');
      if(sourceImage===image&&sourceKey===key)return;
      const max=Math.min(2048,gl.getParameter(gl.MAX_TEXTURE_SIZE)),ratio=Math.min(1,max/innerWidth,max/innerHeight);
      const frame=document.createElement('canvas');frame.width=Math.max(1,Math.round(innerWidth*ratio));frame.height=Math.max(1,Math.round(innerHeight*ratio));
      const context=frame.getContext('2d',{willReadFrequently:true});if(!context)throw new Error('canvas-unavailable');
      const scale=s.backgroundFit==='repeat'?1:s.backgroundFit==='contain'?Math.min(innerWidth/image.naturalWidth,innerHeight/image.naturalHeight):Math.max(innerWidth/image.naturalWidth,innerHeight/image.naturalHeight);
      const width=image.naturalWidth*scale,height=image.naturalHeight*scale,x=(innerWidth-width)/2,y=s.backgroundPosition==='top'?0:s.backgroundPosition==='bottom'?innerHeight-height:(innerHeight-height)/2;
      if(s.backgroundFit==='repeat'){
        context.save();context.scale(ratio,ratio);context.translate(x,y);context.fillStyle=context.createPattern(image,'repeat');context.fillRect(-x,-y,innerWidth,innerHeight);context.restore();
      }else context.drawImage(image,x*ratio,y*ratio,width*ratio,height*ratio);
      const pixels=context.getImageData(0,0,frame.width,frame.height),dim=1-s.backgroundDim/100;
      for(let i=0;i<pixels.data.length;i+=4){const alpha=pixels.data[i+3]/255;for(let c=0;c<3;c++)pixels.data[i+c]=theme[c]*(1-alpha)+pixels.data[i+c]*dim*alpha;pixels.data[i+3]=255;}
      context.putImageData(pixels,0,0);
      const down=Math.max(1,s.blur*ratio/3),small=document.createElement('canvas');small.width=Math.max(1,Math.round(frame.width/down));small.height=Math.max(1,Math.round(frame.height/down));
      const smallContext=small.getContext('2d');if(!smallContext)throw new Error('canvas-unavailable');smallContext.drawImage(frame,0,0,small.width,small.height);
      let newSharp=null,input=null,temp=null,newBlur=null;
      try{
        newSharp=texture(frame);input=texture(small);temp=texture(null,small.width,small.height);newBlur=texture(null,small.width,small.height);
        gl.useProgram(gauss);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.viewport(0,0,small.width,small.height);
        const u=name=>gl.getUniformLocation(gauss,name);
        gl.activeTexture(gl.TEXTURE0);gl.uniform1i(u('uSrc'),0);gl.uniform2f(u('uSize'),small.width,small.height);
        gl.uniform1f(u('uSigma'),Math.max(.5,s.blur*small.width/innerWidth));gl.uniform1f(u('uFlip'),0);
        gl.bindFramebuffer(gl.FRAMEBUFFER,framebuffer);
        for(const [from,to,dx,dy,sat] of [[input,temp,s.blur?1:0,0,1],[temp,newBlur,0,s.blur?1:0,SATURATE]]){
          gl.bindTexture(gl.TEXTURE_2D,from);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,to,0);
          if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw new Error('framebuffer-unavailable');
          gl.uniform2f(u('uDir'),dx,dy);gl.uniform1f(u('uSat'),sat);gl.drawArrays(gl.TRIANGLES,0,3);
        }
        if(gl.getError()!==gl.NO_ERROR)throw new Error('texture-render');
        if(sharp)gl.deleteTexture(sharp);if(blurred)gl.deleteTexture(blurred);sharp=newSharp;blurred=newBlur;newSharp=null;newBlur=null;
        sourceImage=image;sourceKey=key;paintKey='';
      }finally{
        gl.bindFramebuffer(gl.FRAMEBUFFER,null);for(const item of [input,temp,newSharp,newBlur])if(item)gl.deleteTexture(item);
      }
    }
    function uniform(name){if(!uniforms.has(name))uniforms.set(name,gl.getUniformLocation(rim,name));return uniforms.get(name);}
    // Only the refraction band and highlight near the edges are drawn; the middle is the CSS blur. An edge scrolled
    // far off screen leaves every visible pixel unchanged, so it does not count as a change.
    function edgeKey(rect,visible){
      const far=BAND+(rect.radius??RADIUS)+8;
      return [rect.left<visible.left-far?'far':rect.left,rect.top<visible.top-far?'far':rect.top,rect.right>visible.left+visible.width+far?'far':rect.right,rect.bottom>visible.top+visible.height+far?'far':rect.bottom,visible.left,visible.top,visible.width,visible.height].join('|');
    }
    function measure(){
      const own=target.getBoundingClientRect(),extra=options.extendTop?.()||0;
      const box=extra>0?{left:own.left,right:own.right,width:own.width,top:own.top-extra,bottom:own.bottom,height:own.height+extra}:own;
      const ratio=(size,layout)=>layout&&Math.abs(size/layout-1)>.01?size/layout:1;
      const sx=options.local?ratio(own.width,target.offsetWidth):1,sy=options.local?ratio(own.height,target.offsetHeight):1;
      const rect={left:box.left+INSET,top:box.top+INSET,right:box.right-INSET,bottom:box.bottom-INSET,width:Math.max(0,box.width-INSET*2),height:Math.max(0,box.height-INSET*2)};
      rect.radius=RADIUS*Math.min(sx,sy);
      const left=Math.max(0,rect.left),top=Math.max(0,rect.top);
      const visible={left,top,width:Math.max(0,Math.min(innerWidth,rect.right)-left),height:Math.max(0,Math.min(innerHeight,rect.bottom)-top)};
      return {own,sx,sy,rect,visible};
    }
    function draw(rect,visible,s,theme){
      const edges=edgeKey(rect,visible),key=[sourceKey,edges,s.opacity,devicePixelRatio].join('|');
      // A hidden edge is redrawn once scrolling stops, so it skips the work while it moves.
      if(key===paintKey||rimHidden&&paintKey)return;
      paintEdges=edges;
      const max=Math.min(gl.getParameter(gl.MAX_RENDERBUFFER_SIZE),gl.getParameter(gl.MAX_VIEWPORT_DIMS)[0],gl.getParameter(gl.MAX_VIEWPORT_DIMS)[1]);
      const dpr=Math.min(devicePixelRatio||1,2,max/visible.width,max/visible.height);
      const width=Math.max(1,Math.round(visible.width*dpr)),height=Math.max(1,Math.round(visible.height*dpr));
      if(canvas.width!==width)canvas.width=width;if(canvas.height!==height)canvas.height=height;
      gl.useProgram(rim);gl.bindBuffer(gl.ARRAY_BUFFER,quad);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(0);gl.viewport(0,0,width,height);
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,sharp);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,blurred);
      gl.uniform1i(uniform('uSharp'),0);gl.uniform1i(uniform('uBlur'),1);
      gl.uniform2f(uniform('uCanvas'),width,height);gl.uniform1f(uniform('uDpr'),width/visible.width);
      gl.uniform2f(uniform('uClipOffset'),visible.left-rect.left,visible.top-rect.top);gl.uniform2f(uniform('uSize'),rect.width,rect.height);
      gl.uniform1f(uniform('uRadius'),Math.min(rect.radius??RADIUS,rect.width/2,rect.height/2));gl.uniform2f(uniform('uOrigin'),rect.left,rect.top);
      gl.uniform3f(uniform('uU'),1/innerWidth,0,0);gl.uniform3f(uniform('uV'),0,1/innerHeight,0);
      gl.uniform3f(uniform('uPage'),theme[0]/255,theme[1]/255,theme[2]/255);
      gl.uniform4f(uniform('uScrim'),theme[0]/255,theme[1]/255,theme[2]/255,s.opacity/100);
      gl.uniform1f(uniform('uImgAlpha'),1);gl.uniform1f(uniform('uOpaque'),options.local?1:0);
      const edgeSize=Math.min(rect.width,rect.height);
      gl.uniform1f(uniform('uBand'),options.compactEdges?Math.min(8,edgeSize*.12):BAND);gl.uniform1f(uniform('uStrength'),options.compactEdges?Math.min(6,edgeSize*.05):STRENGTH);gl.uniform1f(uniform('uChroma'),CHROMA);gl.uniform1f(uniform('uEdge'),EDGE);gl.uniform1f(uniform('uSpec'),options.highlight===false?0:SPECULAR);
      const angle=LIGHT_ANGLE*Math.PI/180;gl.uniform2f(uniform('uLight'),Math.cos(angle),Math.sin(angle));
      gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.drawArrays(gl.TRIANGLES,0,3);
      if(gl.getError()!==gl.NO_ERROR)throw new Error('webgl-render');
      paintKey=key;canvas.style.display='';canvas.style.opacity=rimHidden?'0':'1';
    }
    function fallback(renderer,reason){
      if(canvas)canvas.style.display='none';emit(renderer,reason);
    }
    function render(){
      if(disposed)return;
      const s=getSettings();
      if(!s.enabled||s.timelineMode!=='liquid'||!s.background||!target?.isConnected){if(layer)layer.style.display='none';if(gl)release();emit('off');return;}
      const {own,sx,sy,rect,visible}=measure(),targetCSS=options.local?getComputedStyle(target):null,{left,top}=visible;
      ensureLayer();if(!visible.width||!visible.height){layer.style.display='none';emit('off','not-visible');return;}
      layer.style.display='block';layer.style.left=`${options.local?(left-own.left)/sx-(parseFloat(targetCSS.borderLeftWidth)||0)+target.scrollLeft:left}px`;layer.style.top=`${options.local?(top-own.top)/sy-(parseFloat(targetCSS.borderTopWidth)||0)+target.scrollTop:top}px`;layer.style.width=`${visible.width/sx}px`;layer.style.height=`${visible.height/sy}px`;
      const radius=Math.min(rect.radius??RADIUS,rect.width/2,rect.height/2),upper=rect.top>=0?radius:0,lower=rect.bottom<=innerHeight?radius:0;
      layer.style.borderRadius=`${upper/sx}px ${upper/sx}px ${lower/sx}px ${lower/sx}px`;
      const theme=getThemeRGB(),supported=canBlur(),solid=reduce.matches||contrast.matches||!supported;
      const filter=solid?'none':`blur(${s.blur}px) saturate(180%)`;
      layer.style.backdropFilter=filter;layer.style.setProperty('-webkit-backdrop-filter',filter);
      layer.style.backgroundColor=contrast.matches?'Canvas':`rgb(${theme.join(' ')} / ${solid?1:s.opacity/100})`;
      if(solid){if(gl)release();fallback('solid',reduce.matches?'reduced-transparency':contrast.matches?'forced-colors':'backdrop-unavailable');return;}
      if(s.liquidLite||tierLevel(s)>=2){if(gl)release();fallback('blur',s.liquidLite?'manual-lite':'performance-lite');return;}
      const image=getImage();if(!image?.naturalWidth){fallback('blur','image-unavailable');return;}
      if(blocked&&blockedImage!==image&&blocked!=='context-lost')blocked='';
      if(blocked){fallback('blur',blocked);return;}
      try{prepareGL();prepareSource(image,s,theme);draw(rect,visible,s,theme);emit('webgl',tierLevel(s)===1?(tierOf(s)==='move'?'manual-move':'performance-move'):'');}
      catch(error){blocked=error.name==='SecurityError'?'image-security':error.message||'webgl-error';blockedImage=image;release();fallback('blur',blocked);}
    }
    function remember(){try{GM_setValue(PERF_KEY,{level,at:Date.now()});}catch{}}
    function downgrade(){level=Math.min(2,level+1);remember();samples=[];strikes=0;paintKey='';if(level===2)rimHidden=false;render();}
    function frame(now){
      raf=0;if(disposed||document.hidden)return;
      if(lastFrame&&getSettings().timelineMode==='liquid'&&tierOf(getSettings())==='auto'&&gl&&!gl.isContextLost()&&level<2){
        const delta=now-lastFrame;best=Math.min(best,delta);samples.push(delta);
        if(samples.length>=40){const limit=Math.max(20,best*1.7),slow=samples.filter(ms=>ms>limit).length/samples.length;samples=[];strikes=slow>.3?strikes+1:0;if(strikes>=2)downgrade();}
      }
      render();
      if(performance.now()<activeUntil&&gl&&tierLevel(getSettings())<2){lastFrame=now;raf=requestAnimationFrame(frame);}else lastFrame=0;
    }
    function schedule(){if(disposed||raf||document.hidden)return;raf=requestAnimationFrame(frame);}
    function wake(){const s=getSettings();if(!s.enabled||s.timelineMode!=='liquid'||!s.background)return;activeUntil=performance.now()+200;schedule();}
    function scroll(){
      const s=getSettings();if(!s.enabled||s.timelineMode!=='liquid'||!s.background)return;
      // The lighter tier hides the edge only while it is actually moving; panels that stay put keep it.
      if(hidesOnMove(s)&&(rimHidden||gl&&paintKey&&target?.isConnected&&moved())){
        rimHidden=true;if(canvas)canvas.style.opacity='0';clearTimeout(scrollTimer);
        scrollTimer=setTimeout(()=>{scrollTimer=0;rimHidden=false;paintKey='';render();if(canvas)canvas.style.opacity='1';},140);
      }
      wake();
    }
    // 自動 follows the measured level; the other choices pin one. Touch and non-Chromium browsers start at the first tier unless 永不降級.
    function tierOf(s){return s.tier??s.liquidTier??'auto';}
    function tierLevel(s){return {full:0,move:1,lite:2}[tierOf(s)]??level;}
    function hidesOnMove(s){const level=tierLevel(s);return level===1||level===0&&tierOf(s)==='auto'&&(touch.matches||!chromium);}
    function moved(){const {rect,visible}=measure();return edgeKey(rect,visible)!==paintEdges;}
    function pointer(event){if(event.pointerType==='mouse')wake();}
    function visibility(){lastFrame=0;samples=[];if(document.hidden){cancelAnimationFrame(raf);raf=0;}else schedule();}
    function preference(){paintKey='';render();}
    const resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>schedule()):null;
    window.addEventListener('scroll',scroll,{passive:true,capture:!!options.local});window.addEventListener('resize',wake,{passive:true});window.addEventListener('pointermove',pointer,{passive:true});
    document.addEventListener('visibilitychange',visibility);
    for(const media of [reduce,contrast,touch])media.addEventListener?.('change',preference);
    return {
      update(primary){if(primary!==target){resizeObserver?.disconnect();target=primary;if(target?.isConnected)resizeObserver?.observe(target);paintKey='';}render();},
      resetPerformance(){level=0;strikes=0;samples=[];best=1000/60;lastFrame=0;blocked='';paintKey='';try{GM_setValue(PERF_KEY,{level:0,at:0});}catch{}render();},
      dispose(){disposed=true;cancelAnimationFrame(raf);clearTimeout(scrollTimer);resizeObserver?.disconnect();window.removeEventListener('scroll',scroll,!!options.local);window.removeEventListener('resize',wake);window.removeEventListener('pointermove',pointer);document.removeEventListener('visibilitychange',visibility);for(const media of [reduce,contrast,touch])media.removeEventListener?.('change',preference);release();layer?.remove();style?.remove();}
    };
  }
  // Audio balancing adapted from TW527E/bilibili-youtube-volume (MIT, Copyright 2026 TW527E).
  function createAudioBalance(getEnabled, onState = () => {}) {
    class BalanceDSP {
      constructor() {
        this.power = 0;
        this.gain = 1;
        this.compression = 1;
        this.mix = 0;
      }
      process(input, output, volume, enabled, rate) {
        if (!input.length || !output.length) return;
        const frames = output[0].length;
        if (volume === 0) {
          output.forEach(channel => channel.fill(0));
          this.power = 0;
          this.gain = this.compression = 1;
          return;
        }
        const dt = frames / rate;
        let power = 0;
        for (const channel of input) for (const sample of channel) power += (sample / volume) ** 2;
        power /= frames * input.length;
        this.power += (power - this.power) * (1 - Math.exp(-dt / 0.3));
        const rms = Math.sqrt(this.power);
        const target = Math.sqrt(power) < 0.01 || rms < 0.01 ? 1 : Math.max(0.125, Math.min(4, 0.126 / rms));
        this.gain += (target - this.gain) * (1 - Math.exp(-dt / (target < this.gain ? 0.15 : 2)));
        const attack = 1 - Math.exp(-1 / rate / 0.003);
        const release = 1 - Math.exp(-1 / rate / 0.25);
        const fade = 1 - Math.exp(-1 / rate / 0.015);
        for (let i = 0; i < frames; i++) {
          let peak = 0;
          for (const channel of input) peak = Math.max(peak, Math.abs(channel[i] / volume * this.gain));
          const reduction = peak > 0.251 ? (0.251 / peak) ** 0.75 : 1;
          this.compression += (reduction - this.compression) *
            (reduction < this.compression ? attack : release);
          this.mix += ((enabled ? 1 : 0) - this.mix) * fade;
          if (!enabled && this.mix < 0.00001) this.mix = 0;
          for (let ch = 0; ch < output.length; ch++) {
            const original = input[Math.min(ch, input.length - 1)][i];
            const processed = Math.max(-0.49, Math.min(0.49,
              original / volume * this.gain * this.compression)) * volume;
            output[ch][i] = original + (processed - original) * this.mix;
          }
        }
      }
    }

    function registerBalanceWorklet(DSP) {
      class BalanceProcessor extends AudioWorkletProcessor {
        static get parameterDescriptors() {
          return [
            { name: 'enabled', defaultValue: 0, automationRate: 'k-rate' },
            { name: 'volume', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' }
          ];
        }
        constructor() {
          super();
          this.dsp = new DSP();
          this.stopped = false;
          this.port.onmessage = event => { if (event.data === 'stop') this.stopped = true; };
        }
        process(inputs, outputs, parameters) {
          if (this.stopped) return false;
          this.dsp.process(inputs[0], outputs[0], parameters.volume[0], parameters.enabled[0] > 0.5, sampleRate);
          return true;
        }
      }
      registerProcessor('x-minimal-volume-balance', BalanceProcessor);
    }

    const byVideo = new WeakMap();
    const entries = new Set();
    const events = ['loadeddata', 'play', 'playing', 'volumechange', 'emptied'];
    let context = null, initialising = null, backend = 'idle', initError = '', lastState = '';
    let disposed = false, captured = false;

    function report() {
      const attached = [...entries];
      const enabled = Boolean(getEnabled()) && !disposed;
      const state = {
        backend,
        enabled,
        active: attached.filter(entry => entry.processor && entry.routed && !entry.error && enabled).length,
        attached: attached.length,
        pending: attached.filter(entry => entry.pending).length,
        waitingGesture: enabled && Boolean(context) && context.state !== 'running' && context.state !== 'closed',
        unsafe: attached.filter(entry => entry.video.readyState >= 2 && !safeMedia(entry.video)).length,
        error: initError || attached.find(entry => entry.error)?.error || ''
      };
      const key = JSON.stringify(state);
      if (key !== lastState) {
        lastState = key;
        onState(state);
      }
    }

    function safeMedia(video) {
      if (!video.currentSrc || video.readyState < 2) return false;
      try {
        const url = new URL(video.currentSrc, location.href);
        return url.protocol === 'data:' || url.origin === location.origin || Boolean(video.crossOrigin);
      } catch { return false; }
    }

    function eligible(entry) {
      const video = entry.video;
      return video.isConnected && safeMedia(video) &&
        (entry.source || (!video.paused && !video.muted && video.volume > 0));
    }

    function initialise() {
      if (initialising) return initialising;
      initialising = (async () => {
        let url;
        try {
          const Context = window.AudioContext || window.webkitAudioContext;
          if (!Context) throw new Error('瀏覽器不支援網頁音訊處理');
          context = new Context();
          context.addEventListener('statechange', () => {
            report();
            if (!disposed && context.state === 'running') update();
          });
          backend = 'pending';
          report();
          if (context.audioWorklet && window.AudioWorkletNode) {
            try {
              url = URL.createObjectURL(new Blob([
                `(${registerBalanceWorklet.toString()})(${BalanceDSP.toString()});`
              ], { type: 'text/javascript' }));
              await context.audioWorklet.addModule(url);
              backend = 'worklet';
            } catch {
              // X's script-src can reject blob worklets; keep its CSP and use the same DSP locally.
            } finally {
              if (url) URL.revokeObjectURL(url);
            }
          }
          if (backend !== 'worklet') {
            if (!context.createScriptProcessor) throw new Error('瀏覽器沒有可用的相容音量處理器');
            backend = 'compat';
          }
        } catch (error) {
          backend = 'unsupported';
          initError = error.message || '目前無法啟用音量平衡';
          if (context && !captured) context.close().catch(() => {});
        }
        report();
        return backend === 'worklet' || backend === 'compat';
      })();
      return initialising;
    }

    function direct(entry) {
      if (entry.source) {
        try { entry.source.disconnect(); } catch { /* It may already be disconnected. */ }
        entry.source.connect(context.destination);
      }
      if (entry.processor) {
        try { entry.processor.disconnect(); } catch { /* Restore the direct route regardless. */ }
        entry.processor.onaudioprocess = null;
        entry.processor.port?.postMessage('stop');
        entry.processor.port?.close();
        entry.processor = null;
      }
      entry.routed = false;
    }

    function fail(entry, message) {
      entry.error = message;
      direct(entry);
      report();
    }

    function parameters(entry) {
      if (backend === 'worklet' && entry.processor) {
        entry.processor.parameters.get('volume').value = entry.video.muted ? 0 : entry.video.volume;
        entry.processor.parameters.get('enabled').value = getEnabled() && !disposed ? 1 : 0;
      }
    }

    function makeProcessor(entry) {
      if (backend === 'worklet') {
        const node = new AudioWorkletNode(context, 'x-minimal-volume-balance', {
          numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
          parameterData: { enabled: 0, volume: entry.video.muted ? 0 : entry.video.volume }
        });
        node.addEventListener('processorerror', () => fail(entry, '音量平衡已停止，已恢復原音'));
        return node;
      }
      const dsp = new BalanceDSP();
      const node = context.createScriptProcessor(2048, 2, 2);
      node.onaudioprocess = event => {
        try {
          const input = [], output = [];
          for (let ch = 0; ch < event.inputBuffer.numberOfChannels; ch++) input.push(event.inputBuffer.getChannelData(ch));
          for (let ch = 0; ch < event.outputBuffer.numberOfChannels; ch++) output.push(event.outputBuffer.getChannelData(ch));
          dsp.process(input, output, entry.video.muted ? 0 : entry.video.volume,
            getEnabled() && !disposed, context.sampleRate);
        } catch {
          fail(entry, '音量平衡已停止，已恢復原音');
        }
      };
      return node;
    }

    async function prepare(entry) {
      if (entry.pending || entry.error || disposed) return;
      entry.pending = true;
      try {
        if (!await initialise() || disposed || !getEnabled() || !eligible(entry)) return;
        if (context.state !== 'running') await context.resume();
        if (context.state !== 'running' || disposed || !getEnabled() || !eligible(entry)) return;
        if (!entry.processor) entry.processor = makeProcessor(entry);
        entry.processor.connect(context.destination);
        // Finish setup and unlock audio before routing the original media into our graph.
        if (!entry.source) {
          entry.source = context.createMediaElementSource(entry.video);
          captured = true;
          entry.source.connect(context.destination);
        }
        entry.source.disconnect();
        entry.source.connect(entry.processor);
        entry.routed = true;
        parameters(entry);
      } catch (error) {
        fail(entry, error.name === 'InvalidStateError'
          ? '影片已有其他音效處理，保留原音'
          : '目前無法處理這段影片，保留原音');
      } finally {
        entry.pending = false;
        report();
      }
    }

    function sync(entry) {
      if (disposed) return;
      if (entry.source && entry.video.isConnected && !entry.video.paused && context.state === 'suspended') {
        context.resume().catch(() => {});
      }
      if (!getEnabled()) {
        if (entry.routed) direct(entry);
        report();
        return;
      }
      if (entry.processor) parameters(entry);
      if (!entry.routed && !entry.error && eligible(entry)) prepare(entry);
      report();
    }

    function attach(video) {
      if (disposed || !(video instanceof HTMLMediaElement)) return;
      let entry = byVideo.get(video);
      if (!entry) {
        entry = { video, source: null, processor: null, pending: false, routed: false, error: '', listening: false };
        entry.sync = () => sync(entry);
        byVideo.set(video, entry);
      }
      if (!entry.listening) {
        events.forEach(event => video.addEventListener(event, entry.sync));
        entry.listening = true;
      }
      if (entry.source && !entries.has(entry)) entry.source.connect(context.destination);
      entries.add(entry);
      sync(entry);
    }

    function update() {
      if (disposed) return;
      for (const entry of entries) {
        if (!entry.video.isConnected) {
          events.forEach(event => entry.video.removeEventListener(event, entry.sync));
          entry.listening = false;
          direct(entry);
          entry.source?.disconnect();
          entries.delete(entry);
        } else sync(entry);
      }
      report();
    }

    function resume() {
      if (disposed) return;
      if (!context) {
        if (!getEnabled() || ![...entries].some(eligible)) return;
        initialise();
      }
      // Called directly from a user gesture, before waiting for an asynchronous worklet load.
      if (context?.state === 'suspended') context.resume().then(update).catch(() => {});
      update();
    }

    function dispose() {
      disposed = true;
      for (const entry of entries) {
        events.forEach(event => entry.video.removeEventListener(event, entry.sync));
        direct(entry);
      }
      entries.clear();
      // Captured media still need this running context for their restored direct route.
      if (context && !captured) context.close().catch(() => {});
      report();
    }

    return { attach, update, resume, dispose };
  }
  // Media resolution adapted from Twitter/X Media Downloader (MIT).
  // Copyright © 2024 - 2025 ChinaGodMan & molanp,Inc.
  function createMediaResolver() {
    const QUERY_ID = '2ICDjqPd81tulZcYrtpTuQ';
    const BEARER = 'AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA';
    const FEATURES = {
      articles_preview_enabled: true,
      c9s_tweet_anatomy_moderator_badge_enabled: true,
      communities_web_enable_tweet_community_results_fetch: false,
      creator_subscriptions_quote_tweet_preview_enabled: false,
      creator_subscriptions_tweet_preview_api_enabled: false,
      freedom_of_speech_not_reach_fetch_enabled: true,
      graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
      longform_notetweets_consumption_enabled: false,
      longform_notetweets_inline_media_enabled: true,
      longform_notetweets_rich_text_read_enabled: false,
      premium_content_api_read_enabled: false,
      profile_label_improvements_pcf_label_in_post_enabled: true,
      responsive_web_edit_tweet_api_enabled: false,
      responsive_web_enhance_cards_enabled: false,
      responsive_web_graphql_exclude_directive_enabled: false,
      responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
      responsive_web_graphql_timeline_navigation_enabled: false,
      responsive_web_grok_analysis_button_from_backend: false,
      responsive_web_grok_analyze_button_fetch_trends_enabled: false,
      responsive_web_grok_analyze_post_followups_enabled: false,
      responsive_web_grok_image_annotation_enabled: false,
      responsive_web_grok_share_attachment_enabled: false,
      responsive_web_grok_show_grok_translated_post: false,
      responsive_web_jetfuel_frame: false,
      responsive_web_media_download_video_enabled: false,
      responsive_web_twitter_article_tweet_consumption_enabled: true,
      rweb_tipjar_consumption_enabled: true,
      rweb_video_screen_enabled: false,
      standardized_nudges_misinfo: true,
      tweet_awards_web_tipping_enabled: false,
      tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
      tweetypie_unmention_optimization_enabled: false,
      verified_phone_label_enabled: false,
      view_counts_everywhere_api_enabled: true
    };

    function mediaURL(value, host) {
      try {
        const url = new URL(value);
        return url.protocol === 'https:' && url.hostname === host && !url.username && !url.password &&
          (!url.port || url.port === '443') ? url : null;
      } catch { return null; }
    }

    function photo(media, index) {
      const url = mediaURL(media.media_url_https, 'pbs.twimg.com');
      if (!url || !url.pathname.startsWith('/media/')) throw new Error('圖片網址無效。');
      url.pathname = url.pathname.replace(/:(?:thumb|small|medium|large|orig)$/, '');
      const suffix = url.pathname.match(/\.([a-z]+)$/i);
      const extension = (url.searchParams.get('format') || suffix?.[1] || 'jpg').toLowerCase();
      if (!['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif'].includes(extension)) throw new Error('圖片格式不支援。');
      if (suffix) url.pathname = url.pathname.slice(0, -suffix[0].length);
      url.search = new URLSearchParams({format: extension, name: 'orig'}).toString();
      url.hash = '';
      return {url: url.href, extension, index};
    }

    function video(media, index) {
      const variants = Array.isArray(media.video_info?.variants) ? media.video_info.variants : [];
      const playable = variants.filter(variant => variant.content_type === 'video/mp4' && mediaURL(variant.url, 'video.twimg.com'));
      playable.sort((a, b) => (Number(b.bitrate) || 0) - (Number(a.bitrate) || 0));
      if (!playable.length) throw new Error('找不到可下載的 MP4 影片。');
      return {url: mediaURL(playable[0].url, 'video.twimg.com').href, extension: 'mp4', index};
    }

    function mediaItems(media) {
      if (!Array.isArray(media) || !media.length) throw new Error('這則貼文沒有可下載的圖片或影片。');
      return media.map((item, index) => {
        if (item?.type === 'photo') return photo(item, index + 1);
        if (item?.type === 'video' || item?.type === 'animated_gif') return video(item, index + 1);
        throw new Error('這則貼文包含目前不支援下載的媒體。');
      });
    }
    // Errors that mean the request shape is stale rather than the post being unavailable.
    const stale = message => Object.assign(new Error(message), {stale: true});
    let api = {queryId: QUERY_ID, features: FEATURES}, discovery = null;

    async function graphql(tweetId, cookies, current) {
      const headers = {
        authorization: `Bearer ${BEARER}`,
        'x-twitter-active-user': 'yes',
        'x-twitter-client-language': cookies.lang || 'en',
        'x-csrf-token': cookies.ct0
      };
      if (cookies.ct0.length === 32 && cookies.gt) headers['x-guest-token'] = cookies.gt;
      const url = new URL(`/i/api/graphql/${current.queryId}/TweetResultByRestId`, location.origin);
      url.searchParams.set('variables', JSON.stringify({
        tweetId, with_rux_injections: false, includePromotedContent: true, withCommunity: true,
        withQuickPromoteEligibilityTweetFields: true, withBirdwatchNotes: true, withVoice: true, withV2Timeline: true
      }));
      url.searchParams.set('features', JSON.stringify(current.features));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      let response, payload;
      try {
        response = await fetch(url.href, {headers, credentials: 'same-origin', signal: controller.signal});
        if (response.status === 429) throw new Error('X 暫時限制請求，請稍後重試。');
        if (response.status === 401 || response.status === 403) throw new Error('無法讀取這則貼文，請確認已登入且有存取權。');
        if ([400, 404, 410, 422].includes(response.status)) throw stale(`X 的媒體介面已變更（HTTP ${response.status}）。`);
        if (!response.ok) throw new Error(`讀取媒體失敗（HTTP ${response.status}）。`);
        try { payload = await response.json(); }
        catch { throw stale('X 回傳的媒體資料無效。'); }
      } catch (error) {
        if (controller.signal.aborted) throw new Error('讀取媒體逾時，請重試。');
        if (error?.name === 'TypeError') throw new Error('讀取媒體失敗，請檢查網路連線後重試。');
        throw error;
      } finally { clearTimeout(timeout); }
      const result = payload?.data?.tweetResult?.result;
      const tweet = result?.tweet || result;
      if (tweet?.__typename === 'TweetTombstone' || tweet?.__typename === 'TweetUnavailable') throw new Error('目前無法讀取這則貼文的媒體。');
      if (!tweet?.legacy) throw stale(payload?.errors?.length ? 'X 的媒體介面已變更。' : '目前無法讀取這則貼文的媒體。');
      return mediaItems(tweet.legacy.extended_entities?.media || tweet.legacy.entities?.media);
    }

    // The classic web bundle lists each GraphQL operation with its current ID and feature switches.
    function discover() {
      discovery ??= (async () => {
        const sources = new Set([...document.querySelectorAll('script[src]')].map(script => script.src));
        for (const entry of performance.getEntriesByType?.('resource') || []) sources.add(entry.name);
        const bundles = [...sources].filter(source => /^https:\/\/abs\.twimg\.com\/responsive-web\/client-web(?:-legacy)?\/main\.[\w-]+\.js$/.test(source));
        for (const source of bundles) {
          try {
            const response = await fetch(source, {credentials: 'omit'});
            if (!response.ok) continue;
            const text = await response.text();
            const match = text.match(/queryId:"([\w-]{8,64})",operationName:"TweetResultByRestId",operationType:"query",metadata:\{featureSwitches:\[([^\]]*)\]/);
            if (!match) continue;
            const switches = [...match[2].matchAll(/"(\w{1,100})"/g)].map(item => item[1]);
            return {queryId: match[1], features: Object.fromEntries(switches.map(key => [key, FEATURES[key] ?? false]))};
          } catch {}
        }
        return null;
      })();
      return discovery;
    }

    // Public embed endpoint. Works without the GraphQL query ID, but not for protected posts.
    function syndication(tweetId) {
      return new Promise((resolve, reject) => {
        if (typeof GM_xmlhttpRequest !== 'function') { reject(new Error('請更新腳本並允許 Tampermonkey 的跨站請求權限。')); return; }
        const token = ((Number(tweetId) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');
        const url = `https://cdn.syndication.twimg.com/tweet-result?id=${tweetId}&token=${encodeURIComponent(token)}&lang=en`;
        try {
          GM_xmlhttpRequest({url, method: 'GET', anonymous: true, timeout: 20000, redirect: 'error',
            onload: response => {
              try {
                if (response.status !== 200) throw new Error(`備用媒體來源無法讀取這則貼文（HTTP ${response.status}）。`);
                const tweet = JSON.parse(response.responseText);
                if (tweet?.__typename !== 'Tweet') throw new Error('備用媒體來源無法讀取這則貼文。');
                resolve(mediaItems(tweet.mediaDetails));
              } catch (error) { reject(error instanceof SyntaxError ? new Error('備用媒體來源回傳的資料無效。') : error); }
            },
            onerror: () => reject(new Error('備用媒體來源連線失敗。')),
            ontimeout: () => reject(new Error('備用媒體來源逾時。'))
          });
        } catch { reject(new Error('無法啟動備用媒體來源，請檢查 Tampermonkey 的跨站請求權限。')); }
      });
    }

    async function resolve(tweetId) {
      if (typeof tweetId !== 'string' || !/^\d{1,25}$/.test(tweetId)) throw new Error('貼文網址無效。');
      const cookies = Object.fromEntries(document.cookie.split(';').map(item => {
        const at = item.indexOf('=');
        return at < 0 ? ['', ''] : [item.slice(0, at).trim(), item.slice(at + 1).trim()];
      }));
      if (!cookies.ct0) return syndication(tweetId).catch(error => { throw new Error(`請先登入 X 再重試。（${error.message}）`); });
      let failure;
      try { return await graphql(tweetId, cookies, api); }
      catch (error) { if (!error.stale) throw error; failure = error; }
      const found = await discover();
      if (found && found.queryId !== api.queryId) {
        try { const media = await graphql(tweetId, cookies, found); api = found; return media; }
        catch (error) { if (!error.stale) throw error; }
      }
      try { return await syndication(tweetId); }
      catch (error) { throw new Error(`${failure.message}備用來源也失敗：${error.message}請更新 X 極簡後再試。`); }
    }
    return {resolve, photo};
  }

  // Cross-device storage. Credentials stay in this device's GM storage.
  const SYNC_DEFAULTS={...DEFAULTS,videoVolume:null};
  // A field this version can apply. Unknown or newer-format fields stay in the cloud copy untouched.
  function applicableSyncValue(key,value){
    if(key==='videoVolume')return value===null||validVolume(value);
    if(!Object.hasOwn(DEFAULTS,key))return false;
    return JSON.stringify(normalize({[key]:value})[key])===JSON.stringify(value);
  }
  function normalizeSyncDocument(value){
    if(!value||value.format!=='x-minimal-sync'||value.version!==1||!value.fields||typeof value.fields!=='object'||Array.isArray(value.fields))throw Error('雲端資料格式錯誤，已保留本機資料。');
    const fields=Object.create(null);
    for(const key of Object.keys(value.fields).sort()){
      const field=value.fields[key];
      if(!/^[A-Za-z]\w{0,63}$/.test(key))throw Error('雲端資料的欄位名稱無效，已保留本機資料。');
      if(!field||!Number.isSafeInteger(field.at)||field.at<0||field.at>8640000000000000||typeof field.device!=='string'||!/^[-\w]{0,80}$/.test(field.device))throw Error('雲端資料的版本標記無效。');
      if(field.value===undefined)throw Error('雲端設定內容無效，已保留本機資料。');
      let clean;try{clean=JSON.parse(JSON.stringify(field.value));}catch{throw Error('雲端設定內容無效，已保留本機資料。');}
      fields[key]={value:clean,at:field.at,device:field.device};
    }
    const downloadDeleted=normalizeDownloadDeleted(value.downloadDeleted??{});
    return {format:'x-minimal-sync',version:1,fields,downloadHistory:pruneDownloadHistory(normalizeDownloadHistory(value.downloadHistory??{},true),downloadDeleted),downloadDeleted};
  }
  function mergeSyncDocuments(a,b){
    a=normalizeSyncDocument(a);b=normalizeSyncDocument(b);
    const fields=Object.create(null);
    for(const key of [...new Set([...Object.keys(a.fields),...Object.keys(b.fields)])].sort()){
      const left=a.fields[key],right=b.fields[key];
      fields[key]=!left?right:!right?left:right.at>left.at||right.at===left.at&&right.device>=left.device?right:left;
    }
    const downloadDeleted=mergeDownloadDeleted(a.downloadDeleted,b.downloadDeleted);
    return {format:'x-minimal-sync',version:1,fields,downloadHistory:mergeDownloadHistory(a.downloadHistory,b.downloadHistory,downloadDeleted),downloadDeleted};
  }
  function syncURL(value,provider){
    if(typeof value!=='string'||value.length>2048)throw Error('請輸入有效的同步網址。');
    let url;try{url=new URL(value);}catch{throw Error('請輸入完整的同步網址。');}
    if(url.username||url.password||url.search||url.hash||url.protocol!=='https:')throw Error('同步網址需要 HTTPS，且不能包含帳密、查詢參數或片段。');
    if(provider==='drive'&&(url.origin!=='https://script.google.com'||!/^\/macros\/s\/[\w-]+\/exec$/.test(url.pathname)))throw Error('請使用 Google Apps Script 的 /exec 部署網址。');
    return url.href;
  }
  function loadSyncConfig(){
    const out={provider:'drive',auto:false,drive:{url:'',key:''},webdav:{url:'',user:'',password:''},lastSuccess:0};
    try{
      const raw=GM_getValue(SYNC_CONFIG_KEY,{});
      if(raw?.provider==='webdav')out.provider='webdav';
      for(const provider of ['drive','webdav'])if(raw?.[provider]?.url){
        const url=syncURL(raw[provider].url,provider),entry=raw[provider];
        if(provider==='drive'&&typeof entry.key==='string'&&entry.key.length>=32&&entry.key.length<=256)out.drive={url,key:entry.key};
        if(provider==='webdav'&&typeof entry.user==='string'&&entry.user.length<=256&&!entry.user.includes(':')&&typeof entry.password==='string'&&entry.password.length<=2048)out.webdav={url,user:entry.user,password:entry.password};
      }
      out.auto=raw?.auto===true&&!!out[out.provider].url;
      if(Number.isSafeInteger(raw?.lastSuccess))out.lastSuccess=raw.lastSuccess;
    }catch{}
    return out;
  }
  function loadSyncMeta(){
    let raw={};try{raw=GM_getValue(SYNC_META_KEY,{})||{};}catch{}
    const fields=Object.create(null);
    for(const [key,stamp] of Object.entries(raw.fields||{}))if([...Object.keys(DEFAULTS),'videoVolume'].includes(key)&&Number.isSafeInteger(stamp?.at)&&stamp.at>=0&&typeof stamp.device==='string'&&/^[-\w]{0,80}$/.test(stamp.device))fields[key]={at:stamp.at,device:stamp.device};
    const device=typeof raw.device==='string'&&/^[-\w]{16,80}$/.test(raw.device)?raw.device:Array.from(crypto.getRandomValues(new Uint8Array(16)),v=>v.toString(16).padStart(2,'0')).join('');
    return {device,fields};
  }
  function markSyncFields(previous,next){
    const changed=Object.keys(next).filter(key=>JSON.stringify(previous[key])!==JSON.stringify(next[key]));
    if(!changed.length)return;
    const at=Math.max(Date.now(),...Object.values(syncMeta.fields).map(stamp=>stamp.at+1));
    for(const key of changed)syncMeta.fields[key]={at,device:syncMeta.device};
    try{GM_setValue(SYNC_META_KEY,syncMeta);}catch{syncMessage='本機設定已變更，但同步版本紀錄儲存失敗。';}
  }
  function storageSnapshot(){
    const fields=Object.create(null);
    for(const [key,value] of Object.entries({...settings,videoVolume})){
      const stamp=syncMeta.fields[key]||{at:0,device:''};
      // Untouched defaults stay local, so older versions never see settings they do not know yet.
      if(stamp.at===0&&JSON.stringify(value)===JSON.stringify(SYNC_DEFAULTS[key]))continue;
      fields[key]={value,...stamp};
    }
    return normalizeSyncDocument({format:'x-minimal-sync',version:1,fields,downloadHistory,downloadDeleted});
  }
  let pendingCSS=null;
  function applySynchronized(document){
    const next={...settings},applied=[];
    for(const [key,field] of Object.entries(document.fields)){
      if(key==='videoVolume'||!applicableSyncValue(key,field.value))continue;
      if(key==='customCSS'&&field.value.trim()&&field.value!==settings.customCSS){
        // CSS runs on x.com, so another device's stylesheet waits for confirmation here.
        pendingCSS={value:field.value,at:field.at,device:field.device};continue;
      }
      next[key]=field.value;applied.push(key);
    }
    if(pendingCSS&&(document.fields.customCSS?.value!==pendingCSS.value||settings.customCSS===pendingCSS.value))pendingCSS=null;
    if(JSON.stringify(next)!==JSON.stringify(settings)&&!commit(next,'',false))throw Error('本機設定儲存失敗，雲端版本已保留。');
    const volume=document.fields.videoVolume;
    if(volume&&applicableSyncValue('videoVolume',volume.value)){
      if(videoVolume!==volume.value&&!saveVideoVolume(volume.value,false))throw Error('本機音量儲存失敗。');
      applied.push('videoVolume');
    }
    if(JSON.stringify(document.downloadDeleted)!==JSON.stringify(downloadDeleted))saveDownloadDeleted(document.downloadDeleted);
    if(JSON.stringify(document.downloadHistory)!==JSON.stringify(downloadHistory))saveDownloadHistory(document.downloadHistory,false);
    for(const key of applied){const field=document.fields[key];syncMeta.fields[key]={at:field.at,device:field.device};}
    if(JSON.stringify(GM_getValue(SYNC_META_KEY,{}))!==JSON.stringify(syncMeta))GM_setValue(SYNC_META_KEY,syncMeta);syncUI();mediaDownloader?.update();
  }
  function syncPendingCSSUI(){
    const box=$('#css-pending');box.hidden=!pendingCSS;
    if(!pendingCSS)return;
    $('#css-pending-state').textContent=`另一部裝置在 ${new Date(pendingCSS.at).toLocaleString()} 更新了自訂 CSS（${pendingCSS.value.length} 字元）。自訂 CSS 會直接套用到 X 頁面，請先確認內容。`;
    if($('#css-pending-text').textContent!==pendingCSS.value)$('#css-pending-text').textContent=pendingCSS.value;
  }
  $('#css-accept').addEventListener('click',event=>{
    if(!event.isTrusted||!pendingCSS)return;
    const accepted=pendingCSS;pendingCSS=null;
    if(commit({...settings,customCSS:accepted.value},'',false)){
      syncMeta.fields.customCSS={at:accepted.at,device:accepted.device};
      try{GM_setValue(SYNC_META_KEY,syncMeta);}catch{}
      status('已套用雲端的自訂 CSS。');
    }
    syncPendingCSSUI();
  });
  $('#css-keep').addEventListener('click',event=>{
    if(!event.isTrusted||!pendingCSS)return;
    const rejected=pendingCSS;pendingCSS=null;
    // A stamp newer than the cloud copy makes this device's stylesheet win the next merge everywhere.
    syncMeta.fields.customCSS={at:Math.max(Date.now(),rejected.at+1,...Object.values(syncMeta.fields).map(stamp=>stamp.at+1)),device:syncMeta.device};
    try{GM_setValue(SYNC_META_KEY,syncMeta);}catch{}
    syncPendingCSSUI();syncController?.changed();status('已保留本機的自訂 CSS，下次同步會覆蓋雲端版本。');
  });
  const SYNC_URL_LABEL={drive:'Apps Script 的 /exec 網址',webdav:'同步 JSON 檔案的完整網址（資料夾需已存在）'};
  // Unsaved edits in the connection form survive status updates; saving or switching services reloads it.
  let syncFormDirty=false,syncFormProvider='';
  for(const id of ['#sync-url','#sync-key','#sync-user','#sync-password'])$(id).addEventListener('input',()=>{syncFormDirty=true;});
  function syncFormUI(){
    const provider=syncConfig.provider,entry=syncConfig[provider];
    $('#sync-url-label').textContent=SYNC_URL_LABEL[provider];
    for(const field of shadow.querySelectorAll('[data-sync-provider]'))field.hidden=field.dataset.syncProvider!==provider;
    if(syncFormProvider!==provider){syncFormProvider=provider;syncFormDirty=false;clearSecretFields();}
    if(!syncFormDirty){$('#sync-url').value=entry.url;$('#sync-user').value=syncConfig.webdav.user;}
    $('#sync-key').placeholder=syncConfig.drive.key?'已儲存；留白保留目前的密鑰':'貼上 configureSync 產生的密鑰';
    $('#sync-password').placeholder=syncConfig.webdav.password?'已儲存；留白保留目前的密碼':'WebDAV 應用程式密碼';
  }
  function syncConnectionUI(){
    const provider=syncConfig.provider,entry=syncConfig[provider];
    for(const option of shadow.querySelectorAll('[name="sync-provider"]'))option.checked=option.value===provider;$('#sync-auto').checked=syncConfig.auto;
    $('#sync-connection').textContent=entry.url?`已設定 ${provider==='drive'?'Google Drive':'WebDAV'} · ${new URL(entry.url).host}`:'尚未設定連線。';
    $('#sync-state').textContent=syncMessage||(syncConfig.lastSuccess?`上次同步：${new Date(syncConfig.lastSuccess).toLocaleString()}`:'尚未同步。');
    syncFormUI();
  }
  function persistSyncConfig(next){
    try{GM_setValue(SYNC_CONFIG_KEY,next);syncConfig=next;syncMessage='';syncConnectionUI();return true;}
    catch{syncMessage='同步連線設定儲存失敗。';syncConnectionUI();return false;}
  }
  // Reads the connection form. Empty secret fields keep the saved secret for the same address.
  function connectionFromForm(){
    const provider=syncConfig.provider,old=syncConfig[provider];
    const url=syncURL($('#sync-url').value.trim(),provider);
    if(provider==='drive'){
      const secret=$('#sync-key').value.trim()||url===old.url&&old.key;
      if(typeof secret!=='string'||secret.length<32||secret.length>256)throw Error('同步密鑰需要 32–256 個字元。');
      return {provider,entry:{url,key:secret}};
    }
    const user=$('#sync-user').value.trim();
    const secret=$('#sync-password').value||url===old.url&&user===old.user&&old.password;
    if(!user||user.length>256||user.includes(':')||typeof secret!=='string'||!secret||secret.length>2048)throw Error('請輸入有效的 WebDAV 帳號與應用程式密碼。');
    return {provider,entry:{url,user,password:secret}};
  }
  function clearSecretFields(){$('#sync-key').value='';$('#sync-password').value='';}
  function createStorageSync(){
    let running=false,timer=0,dirty=false,retryAt=0,failures=0,cache=null;
    function request(details){
      return new Promise((resolve,reject)=>{
        if(typeof GM_xmlhttpRequest!=='function'){reject(Error('請更新腳本並允許 Tampermonkey 的跨站請求權限。'));return;}
        if(details.data&&new Blob([details.data]).size>MAX_BACKUP+4096){reject(Error('同步資料超過 32 MiB；已保留本機資料。'));return;}
        let settled=false,handle;
        const finish=(error,response)=>{if(settled)return;settled=true;clearTimeout(deadline);error?reject(error):resolve(response);};
        const deadline=setTimeout(()=>{finish(Error('同步連線逾時，請稍後重試。'));handle?.abort();},20000);
        try{handle=GM_xmlhttpRequest({...details,anonymous:true,timeout:20000,
          onprogress:event=>{if(event.loaded>MAX_BACKUP+4096){finish(Error('雲端資料超過 32 MiB，已停止讀取。'));handle?.abort();}},
          onload:response=>{if(typeof response.responseText!=='string'||new Blob([response.responseText]).size>MAX_BACKUP+4096)finish(Error('雲端回應無效或過大。'));else finish(null,response);},
          onerror:()=>finish(Error('同步連線失敗，請檢查網址、網路與 Tampermonkey 權限。')),
          ontimeout:()=>finish(Error('同步連線逾時，請稍後重試。')),onabort:()=>finish(Error('同步連線已中止。'))});}
        catch{finish(Error('無法啟動同步，請檢查 Tampermonkey 的跨站請求權限。'));}
      });
    }
    function json(response){try{return JSON.parse(response.responseText);}catch{throw Error('雲端回應不是有效的同步 JSON，已保留本機資料。');}}
    async function drive(config,action,data,revision){
      const connection=config.drive,response=await request({url:connection.url,method:'POST',redirect:'follow',headers:{'Content-Type':'text/plain;charset=UTF-8'},data:JSON.stringify({version:1,key:connection.key,action,data,revision})});
      if(response.status!==200)throw Error(`Google Drive 同步失敗（HTTP ${response.status}）。`);
      if(response.finalUrl&&!/^https:\/\/(script\.google\.com|script\.googleusercontent\.com)\//.test(response.finalUrl))throw Error('Google Drive 回應的來源不符。');
      const result=json(response);
      if(result.error==='conflict')return {conflict:true};
      if(!result.ok)throw Error(({unauthorized:'Google Drive 同步密鑰錯誤。','not-configured':'請先執行 Apps Script 的 configureSync。',invalid:'Google Drive 收到的同步資料無效。'})[result.error]||'Google Drive 同步服務發生錯誤，請稍後重試。');
      if(!Number.isSafeInteger(result.revision)||result.revision<0||action==='read'&&!result.unchanged&&(result.revision===0?result.data!==null:!result.data))throw Error('Google Drive 同步版本無效。');
      return result;
    }
    function webdavHeaders(config){
      const bytes=new TextEncoder().encode(`${config.webdav.user}:${config.webdav.password}`);
      return {Authorization:`Basic ${btoa(Array.from(bytes,b=>String.fromCharCode(b)).join(''))}`};
    }
    async function read(config,previous){
      if(config.provider==='drive'){
        const result=await drive(config,'read',undefined,previous?.revision);
        if(!result.unchanged)return result;
        if(previous&&previous.revision===result.revision)return previous;
        throw Error('Google Drive 同步版本無效。');
      }
      const headers={...webdavHeaders(config),'Cache-Control':'no-cache'};
      if(previous?.revision)headers['If-None-Match']=previous.revision;
      const response=await request({url:config.webdav.url,method:'GET',redirect:'error',headers});
      if(response.finalUrl&&response.finalUrl!==config.webdav.url)throw Error('WebDAV 網址發生轉址，請填入最後的檔案網址。');
      if(response.status===304&&previous?.revision)return previous;
      if(response.status===404)return {data:null,revision:null};
      if(response.status!==200)throw Error(`WebDAV 讀取失敗（HTTP ${response.status}）。`);
      const etag=response.responseHeaders?.match(/^etag:\s*(.+)$/im)?.[1].trim();
      if(!etag||!/^"[^"\r\n]*"$/.test(etag))throw Error('WebDAV 需提供強 ETag，才能安全合併多裝置資料。');
      return {data:json(response),revision:etag};
    }
    async function write(config,data,revision){
      if(config.provider==='drive')return drive(config,'write',data,revision);
      const response=await request({url:config.webdav.url,method:'PUT',redirect:'error',headers:{...webdavHeaders(config),'Content-Type':'application/json',...(revision===null?{'If-None-Match':'*'}:{'If-Match':revision})},data:JSON.stringify(data)});
      if(response.finalUrl&&response.finalUrl!==config.webdav.url)throw Error('WebDAV 網址發生轉址，請填入最後的檔案網址。');
      if(response.status===412)return {conflict:true};
      if(![200,201,204].includes(response.status))throw Error(`WebDAV 寫入失敗（HTTP ${response.status}）。`);
      return {ok:true};
    }
    async function run(manual=false){
      if(running){dirty=true;return;}
      const config=syncConfig,connection=config[config.provider];
      const active=()=>config.provider===syncConfig.provider&&connection===syncConfig[config.provider];
      if(!config[config.provider].url){syncMessage='請先設定同步連線。';syncConnectionUI();return;}
      if(!manual&&(!config.auto||Date.now()<retryAt||document.hidden))return;
      running=true;dirty=false;clearTimeout(timer);timer=0;$('#sync-now').disabled=true;syncMessage='正在合併並同步…';syncConnectionUI();
      try{
        let completed=false;
        for(let attempt=0;attempt<3;attempt++){
          const remote=await read(config,cache?.connection===connection?cache:null);
          if(!active())throw Error('同步連線已變更，請重新同步。');
          const local=storageSnapshot(),merged=remote.data===null?local:mergeSyncDocuments(local,remote.data);
          cache=remote.data===null?null:{...remote,connection};
          if(remote.data===null||JSON.stringify(merged)!==JSON.stringify(normalizeSyncDocument(remote.data))){
            const result=await write(config,merged,remote.revision);if(!active())throw Error('同步連線已變更，請重新同步。');
            if(result.conflict){cache=null;continue;}
            cache=config.provider==='drive'?{data:merged,revision:result.revision,connection}:null;
          }
          const current=mergeSyncDocuments(storageSnapshot(),merged);applySynchronized(current);
          if(JSON.stringify(current)!==JSON.stringify(merged))continue;
          completed=true;break;
        }
        if(!completed)throw Error('多裝置同時更新，請稍後再同步；本機資料已保留。');
        failures=0;retryAt=0;
        const lastSuccess=Date.now();GM_setValue(SYNC_CONFIG_KEY,{...syncConfig,lastSuccess});syncConfig={...syncConfig,lastSuccess};
        syncMessage=`同步完成 · ${new Date(lastSuccess).toLocaleString()}`;
      }catch(error){failures++;retryAt=Date.now()+Math.min(300000,30000*2**Math.min(failures,4));syncMessage=error.message||'同步失敗，本機資料已保留。';}
      finally{running=false;$('#sync-now').disabled=false;syncConnectionUI();if(dirty&&syncConfig.auto)changed();}
    }
    function changed(){if(running)dirty=true;if(!syncConfig.auto)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;run();},1500);}
    for(const option of shadow.querySelectorAll('[name="sync-provider"]'))option.addEventListener('change',event=>{if(!event.isTrusted||!event.target.checked){syncConnectionUI();return;}persistSyncConfig({...syncConfig,provider:event.target.value==='webdav'?'webdav':'drive',auto:false,lastSuccess:0});});
    function saveConnection(){
      try{
        const {provider,entry}=connectionFromForm();
        syncFormDirty=false;
        if(persistSyncConfig({...syncConfig,auto:false,[provider]:entry,lastSuccess:0})){clearSecretFields();cache=null;syncMessage='已儲存連線。按「測試連線」或「立即同步」確認設定。';syncConnectionUI();}
      }catch(error){syncMessage=error.message;syncConnectionUI();}
    }
    $('#sync-save').addEventListener('click',event=>{if(event.isTrusted)saveConnection();});
    $('#sync-test').addEventListener('click',async event=>{
      if(!event.isTrusted)return;
      const button=$('#sync-test');
      try{
        const {provider,entry}=connectionFromForm();
        button.disabled=true;syncMessage='正在測試連線…';syncConnectionUI();
        const remote=await read({...syncConfig,provider,[provider]:entry},null);
        if(remote.data!==null)normalizeSyncDocument(remote.data);
        syncMessage=remote.data===null?'連線成功；雲端還沒有同步資料，第一次同步時會建立。':'連線成功，雲端資料可以讀取。';
      }catch(error){syncMessage=`測試失敗：${error.message}`;}
      finally{button.disabled=false;syncConnectionUI();}
    });
    for(const id of ['#sync-url','#sync-key','#sync-user','#sync-password'])$(id).addEventListener('keydown',event=>{if(event.key==='Enter'&&event.isTrusted){event.preventDefault();saveConnection();}});
    $('#sync-auto').addEventListener('change',event=>{if(!event.isTrusted){syncConnectionUI();return;}if(event.target.checked&&!syncConfig[syncConfig.provider].url){syncMessage='請先設定同步連線。';syncConnectionUI();return;}if(persistSyncConfig({...syncConfig,auto:event.target.checked}))changed();});
    $('#sync-now').addEventListener('click',event=>{if(event.isTrusted)run(true);});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)changed();});
    setInterval(()=>{if(!document.hidden&&syncConfig.auto)run();},60000);
    window.addEventListener('pagehide',()=>{clearTimeout(timer);timer=0;});
    syncConnectionUI();if(syncConfig.auto)changed();
    return {changed};
  }

  function canonicalMedia(value) {
    if(typeof value!=='string'||value.length>4096)return '';
    try {
      const url=new URL(value);
      if(url.protocol!=='https:'||url.username||url.password||url.port)return '';
      if(url.hostname==='pbs.twimg.com'&&url.pathname.startsWith('/media/')){
        const format=(url.searchParams.get('format')||url.pathname.match(/\.([a-z]+)$/i)?.[1]||'jpg').toLowerCase();
        if(!['jpg','jpeg','png','webp','gif','avif'].includes(format))return '';
        url.pathname=url.pathname.replace(/\.(jpg|jpeg|png|webp|gif|avif)$/i,'');
        url.search=new URLSearchParams({format}).toString();
      }else if(url.hostname==='video.twimg.com'&&/\.mp4$/i.test(url.pathname))url.search='';
      else return '';
      url.hash='';return url.href;
    }catch{return '';}
  }
  function normalizeDownloadHistory(value,strict=false) {
    const out=Object.create(null);
    if(!value||typeof value!=='object'||Array.isArray(value)){if(strict)throw Error('下載紀錄格式錯誤。');return out;}
    for(const id of Object.keys(value).sort()){
      const post=value[id];
      if(!/^\d{1,25}$/.test(id)||!post||!/^\w{1,30}$/.test(post.author)||!Number.isInteger(post.total)||post.total<1||post.total>1000||!post.files||typeof post.files!=='object'||Array.isArray(post.files)){if(strict)throw Error('下載紀錄格式錯誤。');continue;}
      const files=Object.create(null);
      for(const key of Object.keys(post.files).sort()){
        const file=post.files[key],url=canonicalMedia(key);
        if(!url||!file||!Number.isInteger(file.index)||file.index<1||file.index>post.total||typeof file.name!=='string'||!/^[\w.-]{1,180}$/.test(file.name)||!Number.isSafeInteger(file.downloadedAt)||file.downloadedAt<1){if(strict)throw Error('下載紀錄包含無效媒體。');continue;}
        if(!files[url]||file.downloadedAt>files[url].downloadedAt)files[url]={index:file.index,name:file.name,downloadedAt:file.downloadedAt};
      }
      if(Object.keys(files).length)out[id]={author:post.author,total:post.total,files};
    }
    return out;
  }
  function mergeDownloadHistory(a,b,deleted=downloadDeleted) {
    const out=normalizeDownloadHistory(a);
    for(const [id,post] of Object.entries(normalizeDownloadHistory(b))){
      const previous=out[id];
      if(!previous){out[id]=post;continue;}
      for(const [url,file] of Object.entries(post.files))if(!previous.files[url]||file.downloadedAt>previous.files[url].downloadedAt)previous.files[url]=file;
      previous.total=Math.max(previous.total,post.total);
    }
    return pruneDownloadHistory(normalizeDownloadHistory(out),deleted);
  }
  // Removal markers: "*" clears everything recorded before it, a post ID clears that post.
  function normalizeDownloadDeleted(value) {
    const entries=[];
    if(value&&typeof value==='object'&&!Array.isArray(value))for(const [id,at] of Object.entries(value))if((id==='*'||/^\d{1,25}$/.test(id))&&Number.isSafeInteger(at)&&at>0)entries.push([id,at]);
    const all=entries.find(([id])=>id==='*')?.[1]||0;
    const posts=entries.filter(([id,at])=>id!=='*'&&at>all).sort((x,y)=>y[1]-x[1]||x[0].localeCompare(y[0])).slice(0,5000);
    const out=Object.create(null);
    if(all)out['*']=all;
    for(const [id,at] of posts.sort((x,y)=>x[0].localeCompare(y[0])))out[id]=at;
    return out;
  }
  function mergeDownloadDeleted(a,b) {
    const out={...normalizeDownloadDeleted(a)};
    for(const [id,at] of Object.entries(normalizeDownloadDeleted(b)))out[id]=Math.max(out[id]||0,at);
    return normalizeDownloadDeleted(out);
  }
  function pruneDownloadHistory(history,deleted) {
    const all=deleted['*']||0,out=Object.create(null);
    for(const [id,post] of Object.entries(history)){
      const limit=Math.max(all,deleted[id]||0);
      if(!limit){out[id]=post;continue;}
      const files=Object.create(null);
      for(const [url,file] of Object.entries(post.files))if(file.downloadedAt>limit)files[url]=file;
      if(Object.keys(files).length)out[id]={...post,files};
    }
    return out;
  }
  let historyLimit=50,renderedHistory=null,renderedLimit=0;
  function syncDownloadHistoryUI(){
    if(renderedHistory===downloadHistory&&renderedLimit===historyLimit)return;
    renderedHistory=downloadHistory;renderedLimit=historyLimit;
    const posts=Object.entries(downloadHistory).map(([id,post])=>({id,...post,count:Object.keys(post.files).length,at:Math.max(...Object.values(post.files).map(file=>file.downloadedAt))})).sort((a,b)=>b.at-a.at||a.id.localeCompare(b.id));
    $('#history-count').textContent=posts.length?`${posts.length} 則`:'';
    $('#download-summary').textContent=posts.length?`已記錄 ${posts.length} 則貼文、${posts.reduce((sum,post)=>sum+post.count,0)} 個媒體。`:'尚無下載紀錄。';
    const list=$('#download-history'),fragment=document.createDocumentFragment();
    for(const post of posts.slice(0,historyLimit)){
      const row=document.createElement('li'),link=document.createElement('a'),detail=document.createElement('span');
      link.href=`https://x.com/${post.author}/status/${post.id}`;link.target='_blank';link.rel='noopener noreferrer';link.textContent=`@${post.author} · ${post.id}`;
      detail.textContent=`${post.count} 個媒體 · ${new Date(post.at).toLocaleString()}`;
      const files=document.createElement('details'),summary=document.createElement('summary'),names=document.createElement('ul');
      summary.textContent='檔案紀錄';files.append(summary,names);
      for(const file of Object.values(post.files).sort((a,b)=>a.index-b.index)){
        const item=document.createElement('li');item.textContent=`${file.name} · ${new Date(file.downloadedAt).toLocaleString()}`;names.append(item);
      }
      const remove=document.createElement('button');remove.type='button';remove.className='history-remove';remove.textContent='移除這筆紀錄';
      remove.setAttribute('aria-label',`移除 @${post.author} 貼文 ${post.id} 的下載紀錄`);
      remove.addEventListener('click',event=>{if(event.isTrusted)removeDownloads(post.id);});
      row.append(link,detail,files,remove);fragment.append(row);
    }
    list.replaceChildren(fragment);$('#history-more').hidden=posts.length<=historyLimit;$('#history-clear').hidden=!posts.length;
  }
  function saveDownloadDeleted(next){
    downloadDeleted=mergeDownloadDeleted(mergeDownloadDeleted(downloadDeleted,GM_getValue(DOWNLOAD_DELETED_KEY,{})),next);
    try{GM_setValue(DOWNLOAD_DELETED_KEY,downloadDeleted);}catch{throw Error('下載紀錄的移除標記儲存失敗；請檢查 Tampermonkey storage 空間。');}
    const pruned=pruneDownloadHistory(downloadHistory,downloadDeleted);
    if(JSON.stringify(pruned)!==JSON.stringify(downloadHistory)){
      downloadHistory=pruned;
      try{GM_setValue(DOWNLOAD_KEY,downloadHistory);}catch{throw Error('下載紀錄儲存失敗；請檢查 Tampermonkey storage 空間。');}
    }
  }
  function saveDownloadHistory(next,notify=true){
    const merged=mergeDownloadHistory(mergeDownloadHistory(downloadHistory,GM_getValue(DOWNLOAD_KEY,{})),next);
    downloadHistory=merged;
    try{GM_setValue(DOWNLOAD_KEY,merged);}catch{syncDownloadHistoryUI();throw Error('媒體已下載，但紀錄儲存失敗；請檢查 Tampermonkey storage 空間。');}
    syncDownloadHistoryUI();if(notify)syncController?.changed();return merged;
  }
  function removeDownloads(id){
    const posts=id==='*'?Object.values(downloadHistory):[downloadHistory[id]].filter(Boolean);
    const newest=Math.max(0,...posts.flatMap(post=>Object.values(post.files).map(file=>file.downloadedAt)));
    try{
      saveDownloadDeleted({[id]:Math.max(Date.now(),newest+1)});
      status(id==='*'?'已清空下載紀錄。':'已移除這筆下載紀錄。');
    }catch(error){status(error.message||'移除下載紀錄失敗。',true);}
    syncDownloadHistoryUI();mediaDownloader?.update();syncController?.changed();
  }
  $('#history-clear').addEventListener('click',event=>{
    if(event.isTrusted&&confirm(`清空全部下載紀錄？已下載的檔案不受影響，之後再按下載會重新下載。${syncConfig.auto?'\n\n已開啟自動同步，其他裝置的紀錄也會一併清空。':''}`))removeDownloads('*');
  });
  function rememberDownload(post,item,name,total){
    const url=canonicalMedia(item.url);
    if(!url)throw Error('媒體已下載，但無法記錄這個媒體網址。');
    saveDownloadHistory({[post.id]:{author:post.author,total,files:{[url]:{index:item.index,name,downloadedAt:Date.now()}}}});
  }

  function createMediaDownloader(getEnabled) {
    const resolver=createMediaResolver();
    const ACTION='[data-xm-download]';
    function postMedia(article){
      const links=[...article.querySelectorAll('a[href*="/status/"]')].filter(link=>ownsPostContent(article,link));
      let identity;
      for(const link of links){
        try {
          const url=new URL(link.href,location.href);
          if(!/^(www\.)?(x\.com|twitter\.com)$/.test(url.hostname)||url.protocol!=='https:')continue;
          const match=url.pathname.match(/^\/([a-z0-9_]+)\/status\/(\d+)(?:\/|$)/i);
          if(match){identity={author:match[1],id:match[2]};break;}
        }catch{}
      }
      if(!identity)return null;
      const photos=[],seen=new Set();let hasVideo=false;
      for(const element of article.querySelectorAll('img,video,[data-testid="videoPlayer"]')){
        if(!ownsPostContent(article,element))continue;
        if(element.matches('video,[data-testid="videoPlayer"]')){hasVideo=true;continue;}
        try {
          const url=new URL(element.currentSrc||element.src,location.href);
          if(url.protocol!=='https:'||url.hostname!=='pbs.twimg.com')continue;
          if(/^\/(ext_tw_video_thumb|amplify_video_thumb|tweet_video_thumb)\//.test(url.pathname)){hasVideo=true;continue;}
          if(!url.pathname.startsWith('/media/'))continue;
          const photo=resolver.photo({media_url_https:url.href},photos.length+1);
          if(!seen.has(photo.url)){seen.add(photo.url);photos.push(photo);}
        }catch{}
      }
      return hasVideo||photos.length?{...identity,photos,hasVideo}:null;
    }
    function downloadFile(media,name){
      return new Promise((resolve,reject)=>{
        if(typeof GM_download!=='function'){reject(new Error('請更新並啟用 Tampermonkey 的下載功能。'));return;}
        try {
          GM_download({url:media.url,name,saveAs:false,conflictAction:'uniquify',
            onload:resolve,
            onerror:error=>{
              const message={not_enabled:'請在 Tampermonkey 設定啟用下載功能。',not_whitelisted:'請在 Tampermonkey 允許下載此副檔名。',not_permitted:'請允許 Tampermonkey 的下載權限。',not_supported:'目前瀏覽器不支援 Tampermonkey 下載。'}[error?.error];
              reject(new Error(message||'下載失敗，請檢查網路連線後重試。'));
            },
            ontimeout:()=>reject(new Error('下載逾時，請重試。'))
          });
        }catch(error){reject(new Error(error.message||'無法啟動下載，請檢查 Tampermonkey 的下載設定。'));}
      });
    }
    function makeButton(article,post,native){
      const button=document.createElement('button');button.type='button';button.dataset.xmDownload=post.id;
      button.className='xm-media-download';button.title='下載這則貼文的所有媒體';button.setAttribute('aria-label','下載媒體');
      const pill=native?.querySelector('.x-engagement-pill');
      if(pill){button.className=`${native.className} xm-media-download`;button.setAttribute('data-xm-native-action','');}
      button.innerHTML='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM4 16h2v4h12v-4h2v6H4v-6Z"/></svg><span class="xm-media-result" role="status" aria-live="polite"></span>';
      if(pill){const frame=document.createElement('span');frame.className=pill.className;frame.append(button.firstElementChild);button.prepend(frame);}
      let busy=false;
      const output=button.querySelector('.xm-media-result');
      decorate(button,post);
      button.addEventListener('click',async event=>{
        event.preventDefault();event.stopPropagation();
        if(busy||!getEnabled())return;
        const current=postMedia(article);if(!current)return;
        button.removeAttribute('data-xm-download-error');setIcon(button,ICON_DOWNLOAD);
        busy=true;button.disabled=true;button.setAttribute('aria-busy','true');
        output.textContent='…';button.title='正在讀取媒體…';
        let completed=0;
        try {
          const media=await resolver.resolve(current.id);
          for(const item of media){
            const name=`${current.author}_${current.id}_${String(item.index).padStart(2,'0')}.${item.extension}`;
            button.title=`正在下載 ${completed+1}/${media.length}`;
            output.textContent=`${completed}/${media.length}`;
            if(!event.shiftKey&&downloadHistory[current.id]?.files[canonicalMedia(item.url)]){completed++;continue;}
            await downloadFile(item,name);completed++;rememberDownload(current,item,name,media.length);
          }
          output.textContent='✓';
        }catch(error){
          button.setAttribute('data-xm-download-error','');
          output.textContent='!';button.title=`${completed?`已下載 ${completed} 個；`:''}${error.message}按一下重試。`;
          button.setAttribute('aria-label',`下載失敗：${button.title}`);
        }finally{busy=false;button.disabled=false;button.removeAttribute('aria-busy');decorate(button,current);}
      });
      return button;
    }
    const ICON_DOWNLOAD='M11 3h2v10.17l3.59-3.58L18 11l-6 6-6-6 1.41-1.41L11 13.17V3ZM4 16h2v4h12v-4h2v6H4v-6Z';
    const ICON_DONE='m9.5 18.5-6-6L5 11l4.5 4.5L20 5l1.5 1.5z';
    const ICON_ERROR='M12 2a10 10 0 1 1 0 20 10 10 0 0 1 0-20Zm0 2a8 8 0 1 0 0 16 8 8 0 0 0 0-16Zm-1 3h2v7h-2V7Zm0 9h2v2h-2v-2Z';
    function setIcon(button,shape){const path=button.querySelector('svg path');if(path&&path.getAttribute('d')!==shape)path.setAttribute('d',shape);}
    function decorate(button,post){
      if(button.disabled)return;
      const output=button.querySelector('.xm-media-result');
      if(button.hasAttribute('data-xm-download-error')){setIcon(button,ICON_ERROR);return;}
      const saved=downloadHistory[post.id];
      if(!saved){
        setIcon(button,ICON_DOWNLOAD);button.removeAttribute('data-xm-downloaded');button.removeAttribute('data-xm-download-partial');
        button.title='下載這則貼文的所有媒體';button.setAttribute('aria-label','下載媒體');
        if(output.textContent)output.textContent='';
        return;
      }
      const count=new Set(Object.values(saved.files).map(file=>file.index)).size;
      const done=count>=saved.total;
      setIcon(button,done?ICON_DONE:ICON_DOWNLOAD);
      button.toggleAttribute('data-xm-downloaded',done);
      button.toggleAttribute('data-xm-download-partial',!done);
      button.title=done?`已下載 ${count} 個媒體；按住 Shift 再按可重新下載。`:`已下載 ${count}/${saved.total} 個媒體；點擊繼續下載。`;
      button.setAttribute('aria-label',button.title);
      const text=done?'✓':`${count}/${saved.total}`;
      if(output.textContent!==text)output.textContent=text;
    }
    function update(){
      if(!getEnabled()){for(const button of document.querySelectorAll(ACTION))button.remove();return;}
      for(const article of document.querySelectorAll('article')){
        const post=postMedia(article);
        const buttons=[...article.querySelectorAll(ACTION)].filter(button=>button.closest('article')===article);
        let button=buttons.find(button=>post&&button.dataset.xmDownload===post.id);
        for(const previous of buttons)if(previous!==button)previous.remove();
        if(!post){button?.remove();continue;}
        const groups=[...article.querySelectorAll('[role="group"]')].filter(group=>ownsPostContent(article,group)&&!group.querySelector('[role="slider"]'));
        const actions=groups.find(group=>group.querySelector('[data-engagement-action],[data-testid="reply"],[data-testid="like"]'))||groups.at(-1);
        const native=actions&&[...actions.querySelectorAll('button:not([data-xm-download])')].filter(element=>ownsPostContent(article,element)).at(-1);
        if(button){
          decorate(button,post);
          if(native&&!button.hasAttribute('data-xm-native-action')&&!native.matches(':hover'))button.style.setProperty('--xm-action-muted',getComputedStyle(native.querySelector('svg')||native).color);
          continue;
        }
        button=makeButton(article,post,native);
        if(native&&!button.hasAttribute('data-xm-native-action'))button.style.setProperty('--xm-action-muted',getComputedStyle(native.querySelector('svg')||native).color);
        const tail=native?.parentElement;
        const destination=button.hasAttribute('data-xm-native-action')&&tail!==actions&&getComputedStyle(tail).display.includes('flex')?tail:actions||article;
        destination.append(button);
      }
    }
    return {update};
  }
  let liquid=null,magneticCursor=null;
  const sidebarStates=new Map(),sidebarLiquids=[],interfaceGlass=new Map();
  let interfaceGlassId=0;
  let interfacePaints=new Set();
  function syncSidebarLiquidUI(){
    const names={webgl:'完整折射',blur:'毛玻璃',solid:'實色背景',off:'未顯示'};
    $('#sidebar-liquid-state').textContent=(!settings.background?'兩側：設定背景圖片後才會套用折射':sidebarLiquids.map(effect=>{
      const state=sidebarStates.get(effect.kind);
      return `${effect.label}：${names[state?.renderer||'off']}${state?.reason?' · '+state.reason:''}`;
    }).join('；'))+([...interfaceGlass.values()].some(record=>['blur','solid'].includes(record.state?.renderer))?'；浮窗／分頁：輕量模式':'');
  }
  liquid=createLiquidGlass(()=>settings,()=>navImage,()=>themeRGB,state=>{
    const reason=state.reason;
    root.dataset.xmLiquid=state.renderer;
    root.dataset.xmLiquidFade=String(state.fade);
    const name={webgl:'完整折射',blur:'毛玻璃',solid:'實色背景',off:settings.background?'此頁面未套用效果':'請先選擇背景圖片'}[state.renderer];
    $('#liquid-state').textContent=`目前：${name}${reason?' · '+reason:''}`;
  });
  function updateUtilityGlass(utility){
    for(const old of document.querySelectorAll('[data-xm-page-glass],[data-xm-utility-path]')){unmark(old,'page-glass');unmark(old,'utility-path');}
    const main=utility?document.querySelector('main'):null;
    const next=main?.querySelector('[data-testid="xchatEmbedRoute"]')?.shadowRoot||[...main?.querySelectorAll('div')||[]].find(e=>e.shadowRoot&&(e.className.includes('--dm-bottom-inset')||e.shadowRoot.querySelector('[data-testid="dm-container"]')))?.shadowRoot||null;
    if(!next&&main&&/^\/i\/chat(\/|$)/.test(location.pathname)&&!chatProbe){
      const deadline=performance.now()+15000;
      const probe=()=>{
        chatProbe=0;
        if(!main.isConnected||!/^\/i\/chat(\/|$)/.test(location.pathname))return;
        if([...main.querySelectorAll('div')].some(e=>e.shadowRoot)){updateUtilityGlass(true);updateInterfaceGlass();}
        else if(performance.now()<deadline)chatProbe=requestAnimationFrame(probe);
      };
      chatProbe=requestAnimationFrame(probe);
    }
    if(next!==chatRoot){
      chatObserver?.disconnect();chatStyle?.remove();chatRoot=next;chatObserver=chatStyle=null;
      if(chatRoot){
        chatStyle=document.createElement('style');
        chatStyle.textContent='[data-xm-ui-floating]{border-color:transparent!important;border-radius:16px!important}:host([data-xm-chat-active]) [data-xm-chat-fade]{background-image:none!important}[data-xm-ui-glass]{position:relative;isolation:isolate;background:rgb(var(--xm-rgb) / var(--xm-sidebar-opacity))!important;backdrop-filter:blur(var(--xm-sidebar-blur))}[data-xm-ui-glass]:is([data-xm-glass-renderer=webgl],[data-xm-glass-renderer=blur],[data-xm-glass-renderer=solid]){background:transparent!important;backdrop-filter:none!important}[data-xm-ui-clear]{background:transparent!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}';
        chatRoot.append(chatStyle);
        chatObserver=new MutationObserver(()=>{updateUtilityGlass(true);updateInterfaceGlass();schedule();});
        chatObserver.observe(chatRoot,{childList:true,subtree:true,attributes:true,attributeFilter:['data-open','hidden','aria-hidden']});
      }
    }
    if(chatRoot){
      chatRoot.host.toggleAttribute('data-xm-chat-active',settings.enabled);
      for(const fade of chatRoot.querySelectorAll('.pointer-events-none')){
        if(fade.closest('[data-testid="dm-conversation-header"],[data-testid="dm-conversation-content"]')&&getComputedStyle(fade).backgroundImage.includes('gradient'))mark(fade,'chat-fade');
      }
    }
    if(!main)return;
    const page=chatRoot&&[...chatRoot.children].find(e=>e.tagName==='DIV')||main;
    mark(page,'page-glass');
    if(settings.enabled&&settings.background&&settings.sidebarMode!=='solid'){
      for(let e=page===main?main:chatRoot.host;e&&e!==document.body;e=e.parentElement)mark(e,'utility-path');
    }
  }
  function updateInterfaceGlass(){
    // The search box left behind by a hidden sidebar floats on the page; with 透明搜尋列 it carries its own pane.
    const floatingSearch=settings.transparentSearch&&root.getAttribute('data-xm-floating-search')==='true'?[...document.querySelectorAll('[data-xm-sidebar] [data-xm-search]')].map(search=>parseFloat(getComputedStyle(search).borderRadius)>=8?search:search.querySelector('[data-xm-search-fill]')||search):[];
    const candidates=[...document.querySelectorAll(INTERFACE_GLASS),...chatRoot?.querySelectorAll(INTERFACE_GLASS)||[],...floatingSearch,dialog].map(element=>{
      if(element!==dialog&&!element.matches('[data-testid="HoverCard"],[data-slot],[data-rootownerid],[role="dialog"],[role="menu"],[role="tooltip"]'))return element;
      return [element,...element.querySelectorAll('div')].find(e=>{const c=getComputedStyle(e),r=e.getBoundingClientRect();return (e.hasAttribute('data-xm-ui-glass')||parseFloat(c.borderRadius)>=8&&c.backgroundColor!=='rgba(0, 0, 0, 0)')&&r.width>=160&&r.height>=32;})||element;
    });
    const visible=settings.enabled&&settings.sidebarMode!=='solid'?candidates.filter(e=>{
      if(!e.isConnected||!e.getClientRects().length||!floatingSearch.includes(e)&&e.closest('[data-xm-nav-panel],[data-xm-sidebar-surface],article')||e.closest('[data-xm-composer]')&&!e.hasAttribute('data-xm-composer'))return false;
      const b=e.getBoundingClientRect();return b.width>0&&b.height>0&&b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight;
    }):[];
    const targets=new Set(visible.filter((e,i)=>visible.indexOf(e)===i&&!visible.some(parent=>parent!==e&&!parent.hasAttribute('data-xm-page-glass')&&parent.contains(e))));
    for(const [element,record] of interfaceGlass)if(!targets.has(element)){
      record.controller.dispose();unmark(element,'ui-glass');unmark(element,'glass-renderer');unmark(element,'timeline-menu');unmark(element,'ui-floating');unmark(element,'glass-merged');interfaceGlass.delete(element);
    }
    // Stacked sticky headers (Explore's search row over its tabs) share one pane: the lower one's glass reaches up behind the upper one.
    const headers=[...targets].filter(e=>e.hasAttribute('data-xm-header')),boxes=new Map(headers.map(e=>[e,e.getBoundingClientRect()])),covers=new Map();
    for(const lower of headers)for(const upper of headers){
      const a=boxes.get(upper),b=boxes.get(lower);
      if(upper!==lower&&Math.abs(a.bottom-b.top)<=1.5&&Math.abs(a.left-b.left)<=1.5&&Math.abs(a.right-b.right)<=1.5&&(parseInt(getComputedStyle(upper).zIndex)||0)>(parseInt(getComputedStyle(lower).zIndex)||0))covers.set(lower,upper);
    }
    const merged=new Set(covers.values());
    const nextPaints=new Set();
    for(const element of targets){
      mark(element,'ui-glass');
      if(merged.has(element))mark(element,'glass-merged');else unmark(element,'glass-merged');
      if(element.matches('[data-xm-composer],[data-xm-header],[data-xm-home-tabs],[data-xm-page-glass],[role="tablist"]')){
        for(const child of element.querySelectorAll('div,header')){
          if(child.id.startsWith('xm-liquid')||child.closest('[data-xm-ui-glass]')!==element||!isReadingSurface(child))continue;
          const css=getComputedStyle(child),rgb=colorRGB(css.backgroundColor);
          if(child.hasAttribute('data-xm-ui-clear')||css.backdropFilter!=='none'||rgb?.every((c,i)=>c===themeRGB[i])){nextPaints.add(child);mark(child,'ui-clear');}
        }
      }
      const floating=element===dialog||!!element.closest('[role="menu"],[role="dialog"],[role="tooltip"],[data-testid="HoverCard"],[data-slot$="-content"],[data-base-ui-focusable][data-open][data-side]');
      if(floating)mark(element,'ui-floating');else unmark(element,'ui-floating');
      const owner=document.getElementById(element.getAttribute('aria-labelledby'));
      if(owner?.matches('[data-pinned-timeline]'))mark(element,'timeline-menu');else unmark(element,'timeline-menu');
      let record=interfaceGlass.get(element);
      if(!record){
        record={state:null,controller:null,above:null};interfaceGlass.set(element,record);
        const radius=parseFloat(getComputedStyle(element).borderTopLeftRadius)||0;
        record.controller=createLiquidGlass(()=>({...settings,timelineMode:settings.sidebarMode,liquidLite:settings.sidebarLite,tier:settings.sidebarTier,opacity:element===dialog?Math.max(92,settings.sidebarOpacity):floating?Math.max(80,settings.sidebarOpacity):settings.sidebarOpacity,blur:floating?Math.max(12,settings.sidebarBlur):settings.sidebarBlur}),()=>navImage,()=>themeRGB,state=>{
          record.state=state;mark(element,'glass-renderer',state.renderer);syncSidebarLiquidUI();
        },{id:`xm-liquid-ui-${++interfaceGlassId}`,performanceKey:'x-minimal-ui-liquid-performance',inset:0,radius,local:true,zIndex:-1,compactEdges:true,highlight:!element.hasAttribute('data-xm-composer'),extendTop:()=>{
          const upper=record.above;if(!upper?.isConnected)return 0;
          const a=upper.getBoundingClientRect(),b=element.getBoundingClientRect();return Math.abs(a.bottom-b.top)<=1.5?b.top-a.top:0;
        }});
      }
      record.above=covers.get(element)||null;
      record.controller.update(element);
    }
    for(const element of interfacePaints)if(!nextPaints.has(element))unmark(element,'ui-clear');
    interfacePaints=nextPaints;syncSidebarLiquidUI();
  }
  for(const [kind,label,selector] of [['nav','左側','[data-xm-nav-panel]'],['right','右側','[data-xm-sidebar-surface]']]){
    const controller=createLiquidGlass(()=>({...settings,timelineMode:settings.sidebarMode,liquidLite:settings.sidebarLite,tier:settings.sidebarTier,opacity:settings.sidebarOpacity,blur:settings.sidebarBlur}),()=>navImage,()=>{
      const panel=document.querySelector(selector);
      return panel?(getComputedStyle(panel).getPropertyValue('--xm-rail-rgb').match(/[\d.]+/g)?.slice(0,3).map(Number)||themeRGB):themeRGB;
    },state=>{
      sidebarStates.set(kind,state);mark(document.querySelector(selector),'rail-renderer',state.renderer);syncSidebarLiquidUI();
    },{id:`xm-liquid-${kind}`,inset:kind==='right'?0:8,radius:24,local:true,zIndex:-2});
    sidebarLiquids.push({kind,label,selector,controller});
  }
  audioBalance=createAudioBalance(()=>settings.enabled&&settings.balanceVideoAudio,state=>{
    let message;
    if(!state.enabled)message='已關閉音量平衡，使用播放器原音。';
    else if(state.error)message=state.error;
    else if(state.waitingGesture)message='請點擊播放器以啟用音量平衡。';
    else if(state.active)message=`已啟用音量平衡${state.backend==='compat'?'（相容模式）':''}。`;
    else if(state.pending||state.backend==='pending')message='正在啟用音量平衡…';
    else if(state.unsafe)message='這段媒體保留原生音訊，音量記憶仍可使用。';
    else message='播放有聲影片後啟用音量平衡。';
    $('#audio-state').textContent=message;
    root.dataset.xmAudio=state.enabled?state.backend:'off';
  });
  if(typeof matchMedia==='function')magneticCursor=createMagneticCursor(()=>settings.enabled&&settings.magneticCursor);
  mediaDownloader=createMediaDownloader(()=>settings.enabled&&settings.mediaDownloadEnabled);
  syncController=createStorageSync();
  apply();refresh();syncUI();
})();
