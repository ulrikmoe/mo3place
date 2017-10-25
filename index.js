const fs = require('fs');
const cache = {};
const inclRegex = /{% include "([a-zA-Z0-9./_-]+)" %}/g;
const varRegex = /{{ ([\w [\]'/_-]+) }}/g;

function readFromDisk(filename) {
    try {
        return setCache(filename, fs.readFileSync(filename, 'utf8'));
    } catch (e) {
        throw new Error(filename + ' does not exist');
    }
}

function setCache(filename, value) {
    return cache[filename] = { value, time: Date.now() };
}

function getStr(filename) {
    if (cache[filename]) {
        // Stat the file to see if it changed.
        const mtime = new Date(fs.statSync(filename).mtime);

        // Serve from cache if possible
        if (mtime <= cache[filename].time) {
            return cache[filename].value;
        }
    }
    return readFromDisk(filename).value;
}

// Recursive include (dangerous)
function includer(str) {
    return str.replace(inclRegex, (m, path) => includer(getStr(path)));
}


function flatten (json, opts={}) {
    const prefix = opts.prefix || '.';
    const suffix = opts.suffix || '';
    const output = {};

    function step (obj, prev) {
        const keys = Object.keys(obj);
        for (let i = 0; i < keys.length; i++) {
            const value = obj[keys[i]];
            const name = (prev) ? prev + prefix + keys[i] + suffix : keys[i];
            if (value.constructor === Object) { return step(value, name); }
            output[name] = value;
        }
    }
    step(json);
    return output;
}


function render(str, vars, opts={}) {
    // Include files
    str = includer(str);

    // Replace variables
    if (typeof vars === 'object') {
        const regex = opts.varRegex ? opts.varRegex : varRegex;

        str = str.replace(regex, (match, k1) => {
            if (typeof vars[k1] === 'string') {
                // Replace potential vars in vars[k1].
                return vars[k1].replace(regex, (m2, k2) => vars[k2] || m2);
            }
            if (typeof vars[k1] === 'number') { return vars[k1]; }
            return match;
        });
    }
    return str;
}

module.exports = () => ({ render, setCache, getStr, flatten });
