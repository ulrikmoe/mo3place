'use strict';

const { Transform } = require('node:stream');
const Path = require('node:path');
const fs = require('node:fs');
const inclRegex = /{% include "(.+?)" %}/g;
const varRegex = /{{ (.+?) }}/g;
const uri = 'src/'; // TODO: expose this as an option
const cache = new Map();

function getFile(filename) {
    const stat = fs.statSync(uri + filename, { throwIfNoEntry: false });
    if (!stat) {
        console.error('File not found: ' + filename);
        throw 'File not found: ' + filename;
    }
    let obj = cache.get(filename);
    if (obj && obj.mtime === stat.mtimeMs) return obj;
    obj = {
        str: fs.readFileSync(uri + filename, 'utf8'),
        mtime: stat.mtimeMs,
    };
    cache.set(filename, obj);
    return obj;
}

// Recursively replace inclRegex with the content of the included file
function includer(templateString, mainFile = false) {
    if (typeof templateString !== 'string') {
        throw new TypeError('Expected the first argument to be a string');
    }

    return templateString.replace(inclRegex, (match, filePath) => {
        try {
            const file = getFile(filePath);
            if (!file) {
                console.warn(`File not found: ${filePath}`);
                return match; // Return the original match if the file is not found
            }

            // Update the mtime of the main file if necessary
            if (mainFile && file.mtime > mainFile.stat.mtimeMs) {
                mainFile.stat.mtimeMs = file.mtime;
            }

            // Recursively process included files
            return includer(file.str, mainFile);
        } catch (error) {
            console.error(`Error including file: ${filePath}`, error);
            return ''; // Return an empty string or handle the error as appropriate
        }
    });
}

function replaceVariables(template, variables) {
    if (typeof variables !== 'object' || variables === null) {
        console.log('Variables must be an object');
        return template;
    }
    return template.replace(varRegex, (match, variableName) => {
        const value = variables[variableName];
        if (value === null || value === undefined) {
            console.error('Variable not found:', variableName);
            return match;
        }
        return String(value);
    });
}

/**
 * Processes a template string by including external content and replacing variables.
 */
function fromString(str, vars, opts = {}) {
    if (typeof str !== 'string') {
        throw new TypeError('Expected a string for the first argument.');
    }
    if (typeof vars !== 'object' || vars === null) {
        throw new TypeError('Expected an object for the second argument.');
    }

    try {
        const fullStr = includer(str);
        return replaceVariables(fullStr, vars, opts);
    } catch (error) {
        console.error('Error processing the string:', error);
        return ''; // Return an empty string or handle the error as appropriate.
    }
}

function parseFile(file) {
    const str = file.contents.toString();
    const obj = { str, path: file.path.substring(file._base.length + 1) };
    const lines = str.split('\n', 10); // TODO: make this more efficient and stop...
    if (lines[0] === '<!--') {
        for (let i = 1; i < lines.length; i++) {
            const split = lines[i].split(':');
            if (!split[1]) break;
            obj[split[0]] = split[1].trim();
        }
    }
    if (!obj.title) throw 'No title found in file: ' + file.path;
    if (!obj.url) throw 'No URL found in file: ' + file.path;
    return obj;
}

function flattenObject(obj, parentKey) {
    let result = {};
    Object.entries(obj).forEach(([key, value]) => {
        const _key = parentKey ? `${parentKey}[${key}]` : key;
        if (typeof value === 'object') {
            Object.assign(result, flattenObject(value, _key));
        } else {
            result[_key] = value;
        }
    });
    return result;
}

function tap(fn) {
    return new Transform({
        objectMode: true,
        async transform(file, enc, cb) {
            try {
                await fn(file);
                cb(null, file);
            } catch (err) {
                cb(err);
            }
        },
    });
}

function envParser(o) {
    const args = process.argv.slice(2);
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith('--')) {
                o[key] = nextArg;
                i++;
            }
        }
    }
    return o;
}

function writeSourceMap(dest, str) {
    const dir = Path.dirname(dest);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFile(dest + '.map', str, (err) => {
        if (err) console.error(err);
    });
}

module.exports = () => ({ parseFile, fromString, flattenObject, tap, writeSourceMap, envParser });
