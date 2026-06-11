const axios = require('axios');

async function testGraphQL() {
  const payload = {
    query: `query GetTitle($id: ID!) {
      title(id: $id) {
        primaryImage {
          url
        }
      }
    }`,
    operationName: 'GetTitle',
    variables: { id: 'tt0108052' }
  };

  try {
    const res = await axios.post('https://caching.graphql.imdb.com/', payload, {
      headers: {
        'content-type': 'application/json',
        'user-agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36'
      }
    });
    console.log(JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error(err.message);
  }
}
testGraphQL();
