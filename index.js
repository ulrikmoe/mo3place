const fs = require('fs');
const cache = {};
const inclRegex = /{% include "(.+?)" %}/g;
const varRegex = /{{ (.+?) }}/g;


// Set cache manually
function setCache(filename, str) {
    cache[filename] = { str, mtime: Date.now() };
}

function getFile(filename) {
    try {
        // Modification time (POSIX)
        const mtime = fs.statSync(filename).mtimeMs / 1000;

        // Serve from cache if possible
        if (cache[filename] && mtime === cache[filename].mtime) {
            return cache[filename];
        }
        return cache[filename] = { str: fs.readFileSync(filename, 'utf8'), mtime };
    } catch (e) {
        throw new Error(filename + ' does not exist');
    }
}

// Recursive include files
function includer(str, mainFile) {
    return str.replace(inclRegex, (m, path) => {
        const file = getFile(path)
        if (mainFile && file.mtime * 1000 > mainFile.stat.mtimeMs) {
            mainFile.stat.mtimeMs = file.mtime * 1000;
            mainFile.stat.mtime = file.mtime;
        }
        return includer(file.str, mainFile);
    });
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

function replaceVariables(str, vars, opts) {
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
    return str;
}


function fromString(str, vars, opts={}) {
    const ret = includer(str);
    if (typeof vars === 'object') {
        replaceVariables(ret, vars, opts);
    }
    return ret;
}


function render(file, vars, opts={}) {
    const str = file.contents.toString('utf8'); // maybe consider utf16
    cache[file.path.substring(file._cwd + 1)] = {
        str,
        mtime: file.stat.mtimeMs / 1000
    }
    file.contents = Buffer.from(
        replaceVariables(includer(str, file), vars, opts)
    );
    return file;
}

module.exports = () => ({ render, fromString, setCache, getFile, flatten });
