const { getDefaultConfig } = require('expo/metro-config');
const https = require('https');

const config = getDefaultConfig(__dirname);

config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      // Local dev proxy for TEFAS fund data to completely eliminate CORS on localhost/web
      if (req.url && req.url.startsWith('/api/tefas-funds')) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Content-Type', 'application/json');

        const request = https.get(
          'https://fonfiyat.com.tr/v1/funds.json',
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              Accept: 'application/json, text/plain, */*',
            },
          },
          (apiRes) => {
            apiRes.pipe(res);
          }
        );

        request.on('error', (err) => {
          res.statusCode = 502;
          res.end(JSON.stringify({ error: 'Failed to fetch TEFAS funds', message: err.message }));
        });

        return;
      }
      return middleware(req, res, next);
    };
  },
};

module.exports = config;

