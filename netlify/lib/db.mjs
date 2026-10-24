import { MongoClient } from "mongodb";

let client; // cached across warm invocations
// Returns the users collection, or null when MONGODB_URI isn't set (app then runs without profiles).
export async function users() {
  if (!process.env.MONGODB_URI) return null;
  client ??= new MongoClient(process.env.MONGODB_URI).connect().catch((e) => ((client = null), Promise.reject(e)));
  return (await client).db(process.env.MONGODB_DB ?? "autopilot").collection("users");
}
