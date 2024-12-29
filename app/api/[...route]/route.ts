import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { sendEmail } from './lib/sendMail';
import { getTypeDoujindesu, searchDoujin } from './lib/doujindesu';
import { scrapeWebsite } from './lib/scraping';
import { trackRequest, getStatistics } from './lib/statistics';
import axios from 'axios';
import * as os from 'os';
import * as osu from 'node-os-utils';
import { execSync } from 'child_process';

// export const runtime = 'edge'

const app = new Hono().basePath('/api')

app.get('/hello', (c) => {
  return c.json({
    message: 'Hello from Hono!'
  })
})

app.post('/send-email', async (c) => {
  try {
    const { to, subject, htmlContent } = await c.req.json();
    await sendEmail({ to, subject, htmlContent });
    await trackRequest('/send-email', 'POST');
    return c.json({
      success: true,
      message: 'Email sent successfully'
    });
  } catch (error: any) {
    return c.json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    }, 500);
  }
});

// Search By Type From Doujindesu.tv
app.get('/doujindesu/searchtype', async (c) => {
  try {
    const page = parseInt(c.req.query('page') || '1');
    const type = c.req.query('type') || 'Doujinshi';
    const data = await getTypeDoujindesu(page, type);
    await trackRequest('/doujindesu/searchtype', 'GET');
    return c.json(data);
  } catch (error: any) {
    console.error('Error getting doujindesu data:', error);
    return c.json({ 
      error: 'Failed to get doujindesu data',
      details: error.message 
    }, 500);
  }
});

// Search Doujin From Doujindesu.tv
app.get('/doujindesu/search', async (c) => {
  try {
    let page = 1;
    const pageQuery = c.req.query('page');
    if (pageQuery && !isNaN(parseInt(pageQuery))) {
      page = parseInt(pageQuery);
    }

    const genreString = c.req.query('genre') || '';
    const genres = genreString
      .replace(/[\[\]]/g, '')
      .split(',')
      .map(g => g.trim())
      .filter(g => g !== '');

    const query = {
      title: c.req.query('title') || '',
      author: c.req.query('author') || '',
      character: c.req.query('character') || '',
      status: c.req.query('status') || '',
      type: c.req.query('type') || '',
      genre: genres
    };

    const data = await searchDoujin(page, query);
    await trackRequest('/doujindesu/search', 'GET');
    return c.json(data);
  } catch (error: any) {
    console.error('Error searching doujindesu:', error);
    return c.json({
      error: 'Failed to search doujindesu',
      details: error.message
    }, 500);
  }
});

// Scraping Api
app.post('/scraping', async (c) => {
  try {
    const { url } = await c.req.json();
    
    if (!url) {
      return c.json({
        error: 'URL is required'
      }, 400);
    }

    try {
      new URL(url);
    } catch (error) {
      return c.json({
        error: 'Invalid URL format'
      }, 400);
    }

    const result = await scrapeWebsite(url);
    
    if (!result.success) {
      return c.json({
        error: result.error
      }, 500);
    }

    await trackRequest('/scraping', 'POST');
    return c.json(result.data);
  } catch (error: any) {
    console.error('Error in scraping endpoint:', error);
    return c.json({
      error: 'Failed to process scraping request',
      details: error.message
    }, 500);
  }
});

// Show Image From Url
app.get('/image', async (c) => {
  try {
    const imageUrl = c.req.query('url');
    
    if (!imageUrl) {
      return c.json({ error: 'URL parameter diperlukan' }, 400);
    }

    await trackRequest('/image', 'GET');

    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    const contentType = response.headers.get('content-type');

    return new Response(imageBuffer, {
      headers: {
        'Content-Type': contentType || 'image/jpeg'
      }
    });
  } catch (error: any) {
    return c.json({ 
      error: 'Gagal memuat gambar',
      message: error.message 
    }, 500);
  }
});

// Show Video From Url
app.get('/video', async (c) => {
  try {
    const videoUrl = c.req.query('url');
    
    if (!videoUrl) {
      return c.json({ error: 'URL parameter diperlukan' }, 400);
    }

    await trackRequest('/video', 'GET');

    const range = c.req.header('range');
    const axiosConfig: any = {
      method: 'GET',
      url: videoUrl,
      responseType: 'stream',
      validateStatus: function (status: number) {
        return status >= 200 && status < 300 || status === 206;
      }
    };

    if (range) {
      axiosConfig.headers = { Range: range };
    }

    const response = await axios(axiosConfig);
    const headers: Record<string, any> = {
      'Content-Type': response.headers['content-type'],
      'Content-Length': response.headers['content-length'],
      'Accept-Ranges': 'bytes'
    };

    if (response.headers['content-range']) {
      headers['Content-Range'] = response.headers['content-range'];
    }

    return new Response(response.data, {
      status: response.status,
      headers
    });
  } catch (error: any) {
    return c.json({
      error: 'Gagal memuat video',
      message: error.message
    }, 500);
  }
});

app.get('/statistics', async (c) => {
  try {
    const stats = await getStatistics();
    // Get CPU usage
    const cpuUsage = await new Promise<number>((resolve) => {
      osu.cpu.usage().then(cpuPercentage => {
        resolve(Number(cpuPercentage.toFixed(2)));
      });
    });

    // Get memory information
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsagePercent = Number(((usedMemory / totalMemory) * 100).toFixed(2));

    // Get storage information using df command
    const dfOutput = execSync('df / --output=size,used').toString();
    const [, dfData] = dfOutput.trim().split('\n');
    const [totalBlocks, usedBlocks] = dfData.trim().split(/\s+/).map(Number);
    const blockSize = 1024; // df uses 1K blocks by default
    
    const totalStorage = totalBlocks * blockSize;
    const usedStorage = usedBlocks * blockSize;
    const storageUsagePercent = Number(((usedStorage / totalStorage) * 100).toFixed(2));

    await trackRequest('/statistics', 'GET');
    
    return c.json({
      success: true,
      stats,
      systemStats: {
        cpu: {
          usagePercentage: cpuUsage
        },
        memory: {
          usagePercentage: memoryUsagePercent,
          total: `${(totalMemory / (1024 * 1024 * 1024)).toFixed(2)}GB`,
          used: `${(usedMemory / (1024 * 1024 * 1024)).toFixed(2)}GB`
        },
        storage: {
          usagePercentage: storageUsagePercent,
          total: `${(totalStorage / (1024 * 1024 * 1024)).toFixed(2)}GB`,
          used: `${(usedStorage / (1024 * 1024 * 1024)).toFixed(2)}GB`
        }
      }
    });
  } catch (error: any) {
    return c.json({
      success: false,
      message: 'Failed to get system statistics',
      error: error.message
    }, 500);
  }
});

export const GET = handle(app)
export const POST = handle(app)