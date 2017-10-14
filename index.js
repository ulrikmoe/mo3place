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

function render(str, vars, opts={}) {
    // Include files
    str = str.replace(inclRegex, (m, path) => getStr(path));

    // Replace variables
    if (typeof vars === 'object') {
        const regex = opts.varRegex ? opts.varRegex : varRegex;

        str = str.replace(regex, (m, key) => {
            // Replace variables inside variable.
            const out = vars[key].replace(regex, (m, key) => vars[key] || m);
            return out || m;
        });
    }
    return str;
}

module.exports = () => ({ render, setCache, getStr });
