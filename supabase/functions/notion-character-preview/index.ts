import { createHandler } from './preview.mjs';
Deno.serve(createHandler({env:(name:string)=>Deno.env.get(name)}));
