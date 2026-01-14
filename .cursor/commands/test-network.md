# Test Network Inspection Tools

Test the MCP network inspection and mocking tools against a running demo app.

## Prerequisites
- MCP server running (`yarn dev:server`)
- A demo app running and connected

## Test Scenarios

### 1. List Network Requests
Use `list_network_requests` to see captured traffic:
- Trigger some network requests in the app (load products, etc.)
- Verify requests are captured with URL, method, status
- Test filtering by URL pattern
- Test filtering by HTTP method

### 2. Inspect Request Details
From the list, pick a request and verify:
- Request headers are captured
- Request body is captured (for POST/PUT)
- Response headers are captured
- Response body is captured

### 3. Replay a Request
Use `replay_network_request` to re-execute a request:
- Get a request ID from the list
- Replay it and verify same response
- Test with modifications (different headers/body)

### 4. Mock a Network Request
Use `mock_network_request` to intercept requests:
- Set up a mock for a product API endpoint
- Return custom mock data
- Verify app displays mocked data
- Test with delay parameter for slow network simulation

### 5. Clear Mocks
Use `clear_network_mocks`:
- Clear a specific mock by ID
- Clear all mocks
- Verify app returns to real API data

## Test Cases for Mocking

```json
{
  "urlPattern": "/api/products",
  "mockResponse": {
    "statusCode": 200,
    "body": { "products": [{ "id": 1, "name": "Mock Product" }] },
    "delay": 1000
  }
}
```

## Expected Results
- All network activity should be visible
- Mocks should intercept matching requests
- App should react to mocked responses
