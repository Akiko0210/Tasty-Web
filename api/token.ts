let access_token: string;
let token_expiry: number;

export const bearerToken = (value: string): string => {
  const trimmed = value.trim();
  return trimmed.toLowerCase().startsWith("bearer ")
    ? trimmed
    : `Bearer ${trimmed}`;
};

export const requestToken = async (): Promise<string> => {
  if (access_token && Date.now() + 60 * 1000 < token_expiry) {
    return access_token;
  }

  const raw = JSON.stringify({
    grant_type: "refresh_token",
    refresh_token: process.env.REFRESH_TOKEN,
    client_secret: process.env.CLIENT_SECRET,
  });

  const requestOptions: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "my-app/1.0",
    },
    body: raw,
    redirect: "follow",
  };
  try {
    const url = `${process.env.TASTY_BASE_URL}/oauth/token`;
    const res = await fetch(url, requestOptions);
    if (!res.ok) throw new Error(`Orders API error: ${res.status}`);

    const data = await res.json();
    access_token = data.access_token;
    token_expiry = Date.now() + data.expires_in * 1000;
    // access token is granted.
    return access_token;
  } catch (error) {
    console.log(error, "error");
    throw error;
  }
};
