const fs = require('fs');
const cache = {};
const inclRegex = /{% include "(.+?)" %}/g;
const varRegex = /{{ (.+?) }}/g;


// Set cache manually
function setCache(filename, str) {
    cache[filename] = { str, mtime: Date.now() };
}

function getStr(filename) {
    try {
        // Modification time (POSIX)
        const mtime = fs.statSync(filename).mtimeMs / 1000;

        // Serve from cache if possible
        if (cache[filename] && mtime === cache[filename].mtime) {
            return cache[filename].str;
        }
        cache[filename] = { str: fs.readFileSync(filename, 'utf8'), mtime };
        return cache[filename].str;
    } catch (e) {
        throw new Error(filename + ' does not exist');
    }
}

// Recursive include
function includer(str) {
    return str.replace(inclRegex, (m, path) => includer(getStr(path)));
}

// Flatten objects
function flatten (arr, opts={}) {
    const prefix = opts.prefix || '.';
    const suffix = opts.suffix || '';
    const output = {};

    function step (obj, prev) {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            const val = obj[keys[i]];
            const name = (prev) ? prev + prefix + keys[i] + suffix : keys[i];
            if (val && (val.constructor === Object || val.constructor === Array)) {
                step(val, name);
            } else {
                output[name] = val;
            }
        }
    }

    for (let i = 0; i < arr.length; i++) {
        step(arr[i], null);
    }
    return output;
}


function fromString(str, vars, opts={}) {
    str = includer(str);

    // Replace variables
    if (typeof vars === 'object') {
        const regex = opts.varRegex ? opts.varRegex : varRegex;

        str = str.replace(regex, (match, k1) => {
            if (typeof vars[k1] === 'string') {
                // Once more to replace vars in vars[k1].
                return vars[k1].replace(regex, (m2, k2) => vars[k2] || m2);
            }
            if (typeof vars[k1] === 'number') {
                return vars[k1];
            }
            return match;
        });
    }
    return str;
}


function render(file, vars, opts={}) {
    const mtime = file.stat.mtimeMs / 1000;
    const str = file.contents.toString('utf8'); // maybe consider utf16
    cache[file.path.substring(file._cwd + 1)] = { str, mtime }
    file.contents = Buffer.from(fromString(str, vars, opts));

    // Check if any included files are newer than mtime.
    let t2 = mtime;
    // TODO: make this recursive
    while ((arr = inclRegex.exec(str)) !== null) {
        if (cache[arr[1]].mtime > t2) { t2 = cache[arr[1]].mtime; }
    }
    if (t2 > mtime) { file.stat.mtime = t2; }
    return file;
}

module.exports = () => ({ render, fromString, setCache, getStr, flatten });
