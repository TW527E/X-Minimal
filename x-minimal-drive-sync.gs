const SYNC_LIMIT = 32 * 1024 * 1024;
const DRIVE_FILES = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

function configureSync() {
  const properties = PropertiesService.getScriptProperties();
  let key = properties.getProperty('syncKey');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    properties.setProperty('syncKey', key);
  }
  // Verify the deployment owner's Drive authorization before distributing the key.
  driveRequest_(DRIVE_FILES + '?spaces=appDataFolder&pageSize=1&fields=files(id)');
  console.log('X 極簡同步密鑰（請妥善保管）: ' + key);
}

function doPost(event) {
  const reply = result => ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
  const properties = PropertiesService.getScriptProperties();
  const key = properties.getProperty('syncKey');
  if (!key) return reply({error: 'not-configured'});

  let request;
  try {
    if (!event || !event.postData || event.postData.length > SYNC_LIMIT + 4096) {
      return reply({error: 'invalid'});
    }
    request = JSON.parse(event.postData.contents);
  } catch {
    return reply({error: 'invalid'});
  }
  if (!request || !matchesKey_(key, request.key)) return reply({error: 'unauthorized'});
  if (request.version !== 1 || !['read', 'write'].includes(request.action)) {
    return reply({error: 'invalid'});
  }

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return reply({error: 'busy'});
  try {
    let id = properties.getProperty('syncFileId');
    // Recover a file created before its ID was saved in Script Properties.
    if (!id) {
      const query = encodeURIComponent("name = 'x-minimal-sync.json' and trashed = false");
      const found = driveRequest_(DRIVE_FILES + '?spaces=appDataFolder&fields=files(id)&q=' + query);
      if (found.files.length > 1) return reply({error: 'storage'});
      id = found.files[0]?.id;
      if (id) properties.setProperty('syncFileId', id);
    }
    const fileUrl = id ? '/' + encodeURIComponent(id) : '';
    // The stored revision answers unchanged reads without downloading the whole sync file.
    const knownRevision = Number(properties.getProperty('syncRevision'));
    if (request.action === 'read' && id && Number.isSafeInteger(request.revision) && request.revision > 0 && request.revision === knownRevision) {
      return reply({ok: true, revision: knownRevision, unchanged: true});
    }
    const current = id ? driveRequest_(DRIVE_FILES + fileUrl + '?alt=media') : {revision: 0, data: null};
    if (!Number.isSafeInteger(current.revision) || current.revision < 0 || (id && !validSyncData_(current.data))) {
      return reply({error: 'storage'});
    }
    if (id && current.revision !== knownRevision) properties.setProperty('syncRevision', String(current.revision));
    if (request.action === 'read') {
      if (id && request.revision === current.revision) return reply({ok: true, revision: current.revision, unchanged: true});
      return reply({ok: true, ...current});
    }
    if (!Number.isSafeInteger(request.revision) || !validSyncData_(request.data)) {
      return reply({error: 'invalid'});
    }
    if (request.revision !== current.revision) return reply({error: 'conflict'});
    const revision = current.revision + 1;
    const content = JSON.stringify({revision, data: request.data});
    const metadata = id ? {} : {name: 'x-minimal-sync.json', mimeType: 'application/json', parents: ['appDataFolder']};
    const session = driveResponse_(DRIVE_UPLOAD + fileUrl + '?uploadType=resumable&fields=id',
      id ? 'patch' : 'post', JSON.stringify(metadata), 'application/json; charset=UTF-8',
      {'X-Upload-Content-Type': 'application/json'});
    const headers = session.getAllHeaders();
    const location = Object.entries(headers).find(([name]) => name.toLowerCase() === 'location')?.[1];
    if (typeof location !== 'string' || !/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files(?:[/?]|$)/.test(location)) {
      return reply({error: 'storage'});
    }
    const saved = driveRequest_(location, 'put', content);
    if (!id) properties.setProperty('syncFileId', saved.id);
    properties.setProperty('syncRevision', String(revision));
    return reply({ok: true, revision});
  } catch {
    return reply({error: 'storage'});
  } finally {
    lock.releaseLock();
  }
}

function matchesKey_(expected, supplied) {
  if (typeof supplied !== 'string' || supplied.length !== expected.length) return false;
  let different = 0;
  for (let i = 0; i < expected.length; i++) different |= expected.charCodeAt(i) ^ supplied.charCodeAt(i);
  return different === 0;
}

function validSyncData_(data) {
  return !!data && data.format === 'x-minimal-sync' && data.version === 1
    && !!data.fields && typeof data.fields === 'object' && !Array.isArray(data.fields)
    && !!data.downloadHistory && typeof data.downloadHistory === 'object' && !Array.isArray(data.downloadHistory);
}

function driveRequest_(url, method = 'get', payload) {
  return JSON.parse(driveResponse_(url, method, payload).getContentText());
}

function driveResponse_(url, method, payload, contentType = 'application/json; charset=UTF-8', headers = {}) {
  const options = {
    method,
    followRedirects: false,
    muteHttpExceptions: true,
    headers: {...headers, Authorization: 'Bearer ' + ScriptApp.getOAuthToken()},
  };
  if (payload !== undefined) Object.assign(options, {payload, contentType});
  const response = UrlFetchApp.fetch(url, options);
  const status = response.getResponseCode();
  if (status < 200 || status >= 300) throw new Error('Drive API HTTP ' + status);
  return response;
}
