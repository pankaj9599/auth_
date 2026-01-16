import fetch from "node-fetch";

export async function blockUserIP(ip) {
  const zone = process.env.CF_ZONE_ID;
  const token = process.env.CF_API_TOKEN;

  if (!zone || !token) {
    throw new Error("Cloudflare env vars missing");
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zone}/firewall/access_rules/rules`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mode: "block",
        configuration: { target: "ip", value: ip },
        notes: "Auth abuse – ThreatPilot"
      })
    }
  );

  const data = await res.json();
  if (!data.success) throw new Error("Cloudflare block failed");
  return data.result.id;
}
