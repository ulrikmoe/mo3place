const fs = require('fs');
const cache = {};
let inclRegex = /{% include "([\w./_-]+)" %}/g;
let varRegex = /{{ ([\w./_-]+) }}/g;

function readFromDisk(filename) {
    try {
        return setCache(filename, fs.readFileSync(filename));
    } catch (e) {
        throw new Error(filename + ' does not exist');
    }
}

function setCache(filename, value) {
    return cache[filename] = { value, time: Date.now() };
}

function getFile(filename) {
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

function getStr(filename) {
    return getFile(filename).toString();
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

    return { render, setCache, getFile, getStr };
};
