import * as SecureStore from "expo-secure-store";

const API_BASE = `${process.env.EXPO_PUBLIC_BACKEND_URL || ""}/api`;
const TOKEN_KEY = "neds_seller_auth_token";

export async function getToken(){ return SecureStore.getItemAsync(TOKEN_KEY); }
export async function setToken(token:string){ await SecureStore.setItemAsync(TOKEN_KEY, token); }
export async function clearToken(){ await SecureStore.deleteItemAsync(TOKEN_KEY); }

export async function api<T=any>(path:string, options:{method?:string;body?:any;query?:Record<string,any>;skipAuth?:boolean}={}):Promise<T>{
  let url=`${API_BASE}${path}`;
  if(options.query){const q=new URLSearchParams();Object.entries(options.query).forEach(([k,v])=>{if(v!==undefined&&v!==null&&v!=="")q.append(k,String(v));});const s=q.toString();if(s)url+=`?${s}`;}
  const headers:Record<string,string>={"Content-Type":"application/json"};
  if(!options.skipAuth){const token=await getToken();if(token)headers.Authorization=`Bearer ${token}`;}
  const res=await fetch(url,{method:options.method||"GET",headers,body:options.body?JSON.stringify(options.body):undefined});
  const data=res.headers.get("content-type")?.includes("application/json")?await res.json().catch(()=>null):await res.text();
  if(!res.ok)throw new Error((data&&(data.detail||data.message))||res.statusText||"Request failed");
  return data as T;
}
