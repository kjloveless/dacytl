const VERSION: string = "0.0.1";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const cbreak = true;
let bytesWritten = 0;

interface EditorConfig {
  cursorX: number;
  cursorY: number;
  screenRows: number;
  screenCols: number;
}

const e: EditorConfig = {};
let appendBuffer: string = "";

function abAppend(msg: string) {
  appendBuffer += msg;
}

function abFree() {
  appendBuffer = "";
}

function exit(msg: string, code: number = 0) {
  resetScreen();

  console.log(`${bytesWritten} bytes written this session!\r\n${msg}\r\n`);

  Deno.stdin.close();
  Deno.stdout.close();

  Deno.exit(code);
}

function enableRawMode() {
  // TODO: move cbreak config to .env
  if (cbreak) console.log('signal breaking is on');
  if (Deno.stdin.isTerminal) {
    Deno.stdin.setRaw(true, {cbreak});
  } else {
    console.error('please run me in a terminal');
    exit("error: enableRawMode() not a terminal", -1);
  }
}

// pretty sure Deno disables raw mode, but we like safety
function disableRawMode() {
  Deno.stdin.setRaw(false);
}

// sync reading... cuz we kinda need some input...
function editorReadKey(): number {
  const buffer = new Uint8Array(1);
  let bytesRead: number = 0;

  while (bytesRead != 1) {
    bytesRead = Deno.stdin.readSync(buffer);
  }
  return buffer[0];
}

function getCursorPosition(): boolean {
  const buffer = new Uint8Array(32);
  let i = 0;

  write("\x1b[6n");

  while (i < buffer.length - 1) {
    Deno.stdin.read(buffer);
    const data = decoder.decode(buffer);
    if (data[i] == 'R') break;
    i++;
  }

  if (buffer[0] != '\x1b' || buffer[1] != '[') return false;
  write(buffer);

  return true;
}

function getWindowSize() {
  const { columns, rows } = Deno.consoleSize();
  return { columns, rows };
}

function resetScreen() {
  write("\x1b[2J", true);
  write("\x1b[H", true);
}

function editorDrawRows() {
  let y = 0;
  while (y < e.screenRows) {
    if (y == Math.floor(e.screenRows / 3)) {
      const welcome = `editor -- version ${VERSION}`;
      let padding = Math.floor((e.screenCols - welcome.length) / 2);
      if (padding > 0 ) {
        abAppend("~");
        padding--;
      }
      while (padding--) {
        abAppend(" ");
      }
      abAppend(welcome);
    } else {
      abAppend("~");
    }

    abAppend("\x1b[K");
    if (y < e.screenRows - 1) {
      abAppend("\r\n");
    }
    y++;
  }
}

function editorRefreshScreen() {
  //resetScreen();
  
  abAppend("\x1b[?25l");
  abAppend("\x1b[H");

  editorDrawRows();

  const cursorPosition: string = `\x1b[${e.cursorY};${e.cursorX}H`;
  abAppend(cursorPosition);

  abAppend("\x1b[?25h");

  write(appendBuffer, true);
  abFree();
}

function editorMoveCursor(key: string | number) {
  console.log(key);
  switch (key) {
    case 'a'.charCodeAt(0):
      e.cursorX--;
      break;
    case 'd'.charCodeAt(0):
      e.cursorX++;
      break
    case 'w'.charCodeAt(0):
      e.cursorY--;
      break;
    case 's'.charCodeAt(0):
      e.cursorY++;
      break;
  }
}

function editorProcessKeypress() {
  const char = editorReadKey();

  switch (char) {
    case ctrlKey('q'):
      exit('q->exit');
      break;

    case 'w'.charCodeAt(0):
    case 's'.charCodeAt(0):
    case 'a'.charCodeAt(0):
    case 'd'.charCodeAt(0):
      editorMoveCursor(char);
      break;
  }
}

// Generic write to stdout
// needs to be sync, we need writes to occur in order... or something
function write(bytes: string | Uint8Array, guiBytes: boolean = false) {
  const data = typeof bytes === "string" ? encoder.encode(bytes) : bytes;
  const written = Deno.stdout.writeSync(data);

  if (!guiBytes) bytesWritten += written;
}

function iscntrl(charCode: number): boolean {
  return (charCode < 32 || charCode === 127) ? true : false; 
}

function ctrlKey(key: number | string): number {
  return typeof key === "string" ? key.charCodeAt(0) & 0x1f : key & 0x1f;
}

function initEditor() {
  e.cursorX = 0;
  e.cursorY = 0;

  const { columns, rows } = getWindowSize();
  e.screenRows = rows;
  e.screenCols = columns;
}

if (import.meta.main) {
  enableRawMode();
  initEditor();

  while(true) {
    editorRefreshScreen();
    editorProcessKeypress();
  }

  exit(`bye!`);
}
