const jwt = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxYmU4YmYzNWVlYjUwODI1ODJmYjNiODM5ODU1ZTYxZTBlOTQ0ODViZTAyNDBjZDNiYzAyZTBiM2VhMjQ0MTgwIiwiZXhwIjoxNzYwMTA0MzIxLCJjcmVkaXRzIjoxMDAwMDAwMDAwMCwiaWF0IjoxNzQ0Mzc5NTIxfQ.AY52YDsTwPwOn5D7E5CF6pSjYFvHy3EN8hmWg6DxFwg'
const jwt1 = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwY2JiYzk4NzliZmY5MDc0ZDhlODg3MjY1MGI5ZDg4YzExZmJjYmM2ZDkwZTFlY2Q2MDBjNDcxYzBkNTRhNWEwIiwiZXhwIjoxNzYwMTAzMTM4LCJjcmVkaXRzIjoxMDAwMDAwMDAsImlhdCI6MTc0NDM3ODMzOH0.uHK4g4ogw6_4VLN0uC19j55v3yGBu70R8njxHfNwNog'
const jwt2 = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiI4YzljNGU2MjBkYWU2ZjAwY2M5ZDJjNjkxMmQ3ZDA1NDVkYzJjODU4YjhmNDY2NDBhYjAxNWQ2NWMzZjY3NDViIiwiZXhwIjoxNzYwMjAzMjI5LCJjcmVkaXRzIjo1MDAwMDAwMDAwLCJpYXQiOjE3NDQ0Nzg0Mjl9._bZx9xs9_7G85lgb6c_O33Qp_styja3KZrsvGfrClPs'
const response = await fetch(`https://launchtube.xyz/info`, {
    method: 'GET',
    headers: {
        'Authorization': `Bearer ${jwt2}`,
        'Content-Type': 'application/json'
    }
});

const data = await response.json();
if (data?.credits) {
    const message = `LaunchTube Credits ${Number(data.credits / 10000000)} XLM`
    console.log(message);
}