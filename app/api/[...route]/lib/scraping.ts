import axios from 'axios';
import * as cheerio from 'cheerio'

interface ScrapedLink {
  url: string;
  text: string;
}

interface ScrapedImage {
  url: string;
  alt: string;
}

interface ScrapedData {
  title: string;
  description: string | undefined;
  links: ScrapedLink[];
  images: ScrapedImage[];
  text: string[];
}

interface ScrapeResult {
  success: boolean;
  data?: ScrapedData;
  error?: string;
}

const scrapeWebsite = async (url: string): Promise<ScrapeResult> => {
    try {
        // Use Brightdata to handle any potential blocking
        const response = await axios.post('https://api.brightdata.com/request', {
            zone: 'doujin',
            url: url,
            format: 'raw'
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer 2de006f706f0280a42bd3effb267b852f0392db78e3acbb6f6c9ef124bdb71de'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        
        // Initialize data object
        const scrapedData: ScrapedData = {
            title: $('title').text().trim(),
            description: $('meta[name="description"]').attr('content'),
            links: [],
            images: [],
            text: []
        };

        // Get all links
        $('a').each((i, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().trim();
            if (href && !href.startsWith('#') && text) {
                scrapedData.links.push({
                    url: href,
                    text: text
                });
            }
        });

        // Get all images
        $('img').each((i, el) => {
            const src = $(el).attr('src');
            const alt = $(el).attr('alt');
            if (src) {
                scrapedData.images.push({
                    url: src,
                    alt: alt || ''
                });
            }
        });

        // Get text content from paragraphs
        $('p').each((i, el) => {
            const text = $(el).text().trim();
            if (text) {
                scrapedData.text.push(text);
            }
        });

        return {
            success: true,
            data: scrapedData
        };

    } catch (error) {
        console.error('Error scraping website:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Failed to scrape website'
        };
    }
};

export { scrapeWebsite };
