/**
 * Collects the current VIA view's source image as base64 for server sidecar export.
 * Depends on globals from VIA: _VIA_FILE_TYPE, _VIA_FILE_LOC (loaded earlier in index.html).
 */
(function () {
  var IMAGE_TYPE = 2;
  var LOC_LOCAL = 1;
  var LOC_INLINE = 4;

  function extFrom(fname, mime) {
    var m = (fname || '').match(/\.([a-z0-9]+)$/i);
    if (m) {
      return m[1].toLowerCase();
    }
    if (!mime) {
      return 'jpg';
    }
    var map = {
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'image/bmp': 'bmp',
    };
    return map[mime] || 'jpg';
  }

  function dataUrlToParts(dataUrl) {
    var m = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
    if (!m) {
      return null;
    }
    return { mime: m[1], base64: m[2] };
  }

  window.annotateCollectSidecarImage = function (via) {
    return new Promise(function (resolve, reject) {
      try {
        if (!via || !via.va || !via.va.file_annotator || !via.va.file_annotator[0] || !via.va.file_annotator[0][0]) {
          resolve(null);
          return;
        }
        var fa = via.va.file_annotator[0][0];
        var fid = fa.fid;
        var f = via.d.store.file[fid];
        if (!f || f.type !== IMAGE_TYPE) {
          resolve(null);
          return;
        }

        if (f.loc === LOC_LOCAL && via.d.file_ref[fid]) {
          var file = via.d.file_ref[fid];
          var reader = new FileReader();
          reader.onload = function () {
            var parts = dataUrlToParts(reader.result);
            if (!parts) {
              reject(new Error('Could not read local image'));
              return;
            }
            resolve({
              ext: extFrom(file.name, parts.mime),
              base64: parts.base64,
            });
          };
          reader.onerror = function () {
            reject(new Error('FileReader failed'));
          };
          reader.readAsDataURL(file);
          return;
        }

        if (f.loc === LOC_INLINE && typeof f.src === 'string' && f.src.indexOf('data:') === 0) {
          var inlineParts = dataUrlToParts(f.src);
          if (!inlineParts) {
            reject(new Error('Could not parse inline image'));
            return;
          }
          resolve({
            ext: extFrom(f.fname, inlineParts.mime),
            base64: inlineParts.base64,
          });
          return;
        }

        var el = fa.file_html_element;
        if (!el || el.tagName !== 'IMG' || !el.src) {
          resolve(null);
          return;
        }

        fetch(el.src)
          .then(function (res) {
            if (!res.ok) {
              throw new Error('Fetch image failed: ' + res.status);
            }
            return res.blob();
          })
          .then(function (blob) {
            return new Promise(function (ok, err) {
              var r = new FileReader();
              r.onload = function () {
                var parts = dataUrlToParts(r.result);
                if (!parts) {
                  err(new Error('Could not encode image'));
                  return;
                }
                ok({
                  ext: extFrom(f.fname, blob.type || parts.mime),
                  base64: parts.base64,
                });
              };
              r.onerror = function () {
                err(new Error('FileReader failed'));
              };
              r.readAsDataURL(blob);
            });
          })
          .then(resolve)
          .catch(function (e) {
            reject(e);
          });
      } catch (e) {
        reject(e);
      }
    });
  };
})();
