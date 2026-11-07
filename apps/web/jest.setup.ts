import { TextDecoder, TextEncoder } from "node:util";
import "@testing-library/jest-dom";

// jsdom에는 없지만 브라우저에는 있다. 내보내기 파일을 만드는 코드가 쓴다.
Object.assign(globalThis, { TextDecoder, TextEncoder });
