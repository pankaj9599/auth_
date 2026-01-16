import fetch from "node-fetch";

export async function createJiraRevokeTicket({ user, token }) {
  const auth = Buffer.from(
    `${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`
  ).toString("base64");

  const res = await fetch(
    `${process.env.JIRA_BASE_URL}/rest/api/3/issue`,
    {
      method: "POST",
      headers: {
        "Authorization": `Basic ${auth}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        fields: {
          project: { key: process.env.JIRA_PROJECT_KEY },
          summary: `[Auth] Revoke Token for ${user}`,
          description: `Token suspected of misuse:\n${token}`,
          issuetype: { name: "Task" },
          labels: ["auth", "token", "security"]
        }
      })
    }
  );

  const data = await res.json();
  if (!res.ok) throw new Error("Jira ticket failed");
  return data.key;
}
