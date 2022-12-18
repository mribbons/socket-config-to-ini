"strict"

const fs = require('fs');


var default_ini
    = `;
; Default configuration file for ssc v0.1.0 (f947dcd).
;

; The shell command to execute when building an application. This is the most
; important command in this file. This will do all the heavy lifting and should
; handle 99.9% of your use cases for moving files into place or tweaking
; platform-specific artifacts.
build = "bash build.sh"

; A unique ID that identifies the bundle (used by all app stores).
bundle_identifier = "com.beepboop"

; A string that gets used in the about dialog and package meta info.
copyright = "(c) Beep Boop Corp. 1985"

; A short description of the app.
description = "A UI for the beep boop network"

; An list of environment variables, separated by commas.
env = USER, TMPDIR, PWD

; The name of the file to be output.
executable = "boop"

; If false, the window will never be displayed.
headless = false

; Advanced Compiler Settings (ie C++ compiler -02, -03, etc).
flags = -O3

; Set the limit of files that can be opened by your process.
file_limit = 1024,

; A directory is where your application's code is located.
input = "src"

; Localization
lang = "en-us"

; A String used in the about dialog and meta info.
maintainer = "Beep Boop Corp."

; The name of the program
name = "beepboop"

; The binary output path. It's recommended to add this path to .gitignore.
output = "dist"

; TODO: maybe the user doesn't need to know about this? 
revision = 123

; A string that indicates the version of the application. It should be a semver triple like 1.0.0
version = 0.0.1


[native]

; Files that should be added to the compile step.
files = native-module1.cc native-module2.cc

; Extra Headers
headers = native-module1.hh

[window]
; The initial height of the first window.
height = 80%

; The initial width of the first window.
width = 80%


[debug]

; Advanced Compiler Settings for debug purposes (ie C++ compiler -g, etc).
flags = "-g"


[win]

; The command to execute to spawn the “back-end” process.
cmd = "beepboop.exe"

; The icon to use for identifying your app on Windows.
icon = ""

; The icon to use for identifying your app on Windows.
logo = "src/icons/icon.png"

; A relative path to the pfx file used for signing.
pfx = "certs/cert.pfx"

; The signing information needed by the appx api.
publisher = "CN=Beep Boop Corp., O=Beep Boop Corp., L=San Francisco, S=California, C=US"


[linux]
; Helps to make your app searchable in Linux desktop environments.
categories = "Developer Tools"

; The command to execute to spawn the "back-end" process.
cmd = "beepboop"

; The icon to use for identifying your app in Linux desktop environments.
icon = "src/icon.png"


[mac]

; Mac App Store icon
appstore_icon = "src/icons/icon.png"

; A category in the App Store
category = ""

; The command to execute to spawn the "back-end" process.
cmd = ""

; The icon to use for identifying your app on MacOS.
icon = ""

; TODO description & value (signing guide: https://sockets.sh/guides/#macos-1)
sign = ""

; TODO description & value
codesign_identity = ""

; TODO description & value
sign_paths = ""


[ios]

; signing guide: https://sockets.sh/guides/#ios-1
codesign_identity = ""

; Describes how Xcode should export the archive. Available options: app-store, package, ad-hoc, enterprise, development, and developer-id.
distribution_method = "ad-hoc"

; A path to the provisioning profile used for signing iOS app.
provisioning_profile = ""

; which device to target when building for the simulator
simulator_device = "iPhone 14"
`

var sections = ['native_', 'window_', 'debug_', 'win_', 'linux_', 'mac_', 'ios_', 'android_']
var stock_comments
    = `# Build Settings
# Package Metadata
# Window Settings
# Environment Settings
# Compiler Settings
# Advanced Compiler Settings, ie -O3, -g
# window
`

const help = (argv) => {
    if (argv.length < 4) {
        console.log(`usage: ${argv[0]} ${argv[1]} ssc.config socket.ini`);
        console.log(`socket.ini WILL be OVERWRITTEN.`);
        return true;
    }

    return false;
}

const convert_config_to_map = (input) => {
    var map = { '_': [] }

    sections.forEach(section => { map[section] = [] });

    var lines = input.split('\n');

    var comments = [];

    lines.forEach(line => {

        // line = line.trim();

        if (line.length == 0)
            ;
        else if (line[0] == '#') {
            // console.log(`${line}`);
            if (stock_comments.indexOf(line) < 0) {
                comments.push(line);
            }
        }
        else {
            var line_used = false;


            line = line.replace(':', '\0')
            var [key, val] = line.split('\0', 2);

            val = val.trim();
            if (val != 'true' && val != 'false' && 'env|width|height|file_limit|revision|version'.indexOf(key) < 0)
                val = `"${val}"`;

            var dest_section = undefined;

            sections.forEach(section => {
                if (line.startsWith(section) && dest_section === undefined) {
                    dest_section = section;
                    line_used = true;
                }
            });

            dest_section !== undefined && (key = key.substring(dest_section.length));
            dest_section === undefined && (dest_section = '_');

            if (key == 'width' || key == 'height')
                dest_section = 'window_'; // override section because these ones don't have a prefix


            map[dest_section].push({ key, val, comments });
            comments = [];
        }
    });

    return map;
}

const convert_ini_to_map = (ini) => {
    var map = { '_': [] }
    var maxes = { '_': 0 }

    sections.forEach(section => { map[section] = [], maxes[section] = 0 });

    var lines = ini.split('\n');

    var comments = [];

    var section = '_';

    lines.forEach(line => {
        if (line.length == 0 || line[0] == ';')
            comments.push(line);
        else if (line[0] == '[' && line[line.length - 1] == ']') {
            section = `${line.substring(1, line.length - 1)}_`;
            var si = sections.indexOf(section);
            if (si < 0)
                throw `unhandled section: ${section}`;
        }
        else {
            var [key, val] = line.split('=');
            key = key.trim();
            // val = val.trim();
            // console.log(`push to section: ${section}`);
            map[section].push({ key, val, comments, position: map[section].length });

            // remember the top position for each section so we can use it as default position for any items that we don't know position of from default_ini
            maxes[section] = Math.max(maxes[section], map[section].length);
            comments = [];
        }
    });

    return { map, maxes };
}

const find_ini_line = (config_line, section, ini_map) => {
    return ini_map[section].find(l => l.key == config_line.key);
}

const map_to_ini = (map) => {
    // `${comments.concat('\n')}${comments.length > 0 ? '\n' : ''}${key} = ${value}`);    
    var { map: ini_map, maxes } = convert_ini_to_map(default_ini);

    var output = [];

    ['_', ...sections].forEach(section => {
        var s = { section, lines: [] }
        // output.push(s);

        map[section].forEach(line => {
            const ini_line = find_ini_line(line, section, ini_map);
            if (ini_line !== undefined) {
                line.position = ini_line.position;
                line.comments = [...ini_line.comments, ...line.comments];
            } else {
                line.position = maxes[section]++;
            }
            // console.log(`${JSON.stringify(ini_line)}, ${JSON.stringify(line)}`);
            s.lines.push(line);
        });

        s.lines.sort((a, b) => { return (a.position > b.position ? 1 : -1) })
        if (section != '_')
            output.push(`[${section.substring(0, section.length - 1)}]`);
        s.lines.forEach(line => {
            output.push(...line.comments);
            output.push(`${line.key} = ${line.val}`);
        });

        output.push(``);
    });

    return output.join('\n');

    // console.log(JSON.stringify(ini_map));
}

const main = (argv) => {
    if (help(argv)) return;

    argv = argv.splice(2);

    if (!fs.existsSync(argv[0]))
        console.log(`input ${argv[0]} doesn't exist.`);
    else
        var input = fs.readFileSync(argv[0], 'utf-8');

    if (!input)
        return;

    var map = convert_config_to_map(input);
    // console.log(JSON.stringify(map));
    var lines = map_to_ini(map);
    console.log(`saving to ${argv[1]}`);
    fs.writeFileSync(`${argv[1]}`, lines);
    // console.log(lines);
}

main(process.argv);
