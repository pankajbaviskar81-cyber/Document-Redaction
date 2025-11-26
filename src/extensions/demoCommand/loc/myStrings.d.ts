declare interface IDemoCommandCommandSetStrings {
  Command1: string;
  Command2: string;
}

declare module 'DemoCommandCommandSetStrings' {
  const strings: IDemoCommandCommandSetStrings;
  export = strings;
}
