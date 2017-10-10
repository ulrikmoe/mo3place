const fs = require('fs');
const cache = {};
let inclRegex = /{% include "([\w./_-]+)" %}/g;
let varRegex = /{{ ([\w./_-]+) }}/g;

function readFromDisk(filename) {
    try {
        return setCache(filename, fs.readFileSync(filename, 'utf8'));
    } catch (e) {
        throw new Error(filename + ' does not exist');
    }
}

function setCache(filename, value) {
    return cache[filename] = {
        str: value,
        time: Date.now()
    };
}

function getStr(filename) {
    if (cache[filename]) {
        // Stat the file to see if it changed.
        const mtime = new Date(fs.statSync(filename).mtime);

        // Serve from cache if possible
        if (mtime <= cache[filename].time) {
            return cache[filename].str;
        }
    }
    return readFromDisk(filename).str;
}

function render(str, vars) {
    // Include files
    str = str.replace(inclRegex, (m, path) => getStr(path));

    // Replace variables
    if (typeof vars === 'object') {
        str = str.replace(varRegex, (m, key) => vars[key] || m);
    }
    return str;
}

module.exports = (options={}) => {
    // Redefine regular expressions
    if (options.varRegex) { varRegex = options.varRegex; }
    if (options.inclRegex) { inclRegex = options.inclRegex; }

    return { render, setCache, getStr };
};
