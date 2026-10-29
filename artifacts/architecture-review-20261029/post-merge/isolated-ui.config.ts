import {defineConfig} from '@playwright/test';
import {fileURLToPath} from 'node:url';
import base from '../../tests/browser/ui-refined-v2.config.js';
export default defineConfig({...base,testDir:fileURLToPath(new URL('../../tests/browser',import.meta.url)),reporter:[['line'],['json',{outputFile:"D:/Developing/Meta Hack/test-results/architecture-ui-results.json"}]],outputDir:"D:/Developing/Meta Hack/test-results/architecture-ui",use:{...base.use,baseURL:'http://127.0.0.1:64875'},webServer:{...base.webServer,url:'http://127.0.0.1:64875',command:'node node_modules/vite/bin/vite.js preview --outDir test-results/ui-preview-dist --host 127.0.0.1 --port 64875 --strictPort',reuseExistingServer:false}});
