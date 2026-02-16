// ============================================
// Multi-Modal Extraction Service
// ============================================

import Tesseract from 'tesseract.js';
import pdf from 'pdf-parse';
import sharp from 'sharp';
import axios from 'axios';
import { llmService } from './llm.js';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export interface ImageExtractionResult {
  text: string;
  confidence: number;
  labels?: string[];
  metadata: {
    width: number;
    height: number;
    format: string;
  };
}

export interface PdfExtractionResult {
  text: string;
  pages: number;
  metadata: {
    title?: string;
    author?: string;
    creationDate?: Date;
  };
}

export interface VideoExtractionResult {
  frames: ImageExtractionResult[];
  transcript?: string;
  duration: number;
}

class MultiModalService {
  private static instance: MultiModalService;

  private constructor() {}

  static getInstance(): MultiModalService {
    if (!MultiModalService.instance) {
      MultiModalService.instance = new MultiModalService();
    }
    return MultiModalService.instance;
  }

  // Extract text from image using OCR
  async extractFromImage(imageUrl: string): Promise<ImageExtractionResult> {
    try {
      // Download image if URL
      let imageBuffer: Buffer;
      
      if (imageUrl.startsWith('http')) {
        const response = await axios.get(imageUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        imageBuffer = Buffer.from(response.data);
      } else {
        imageBuffer = Buffer.from(imageUrl, 'base64');
      }

      // Get image metadata
      const metadata = await sharp(imageBuffer).metadata();

      // Preprocess image for better OCR
      const processedBuffer = await this.preprocessImage(imageBuffer);

      // Run OCR
      const result = await Tesseract.recognize(
        processedBuffer,
        config.vision.tesseractLang,
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              logger.debug(`OCR Progress: ${m.progress * 100}%`);
            }
          }
        }
      );

      // Use vision API for additional analysis if available
      let labels: string[] | undefined;
      if (config.vision.googleVisionApiKey) {
        labels = await this.analyzeImageWithVision(imageUrl);
      }

      return {
        text: result.data.text,
        confidence: result.data.confidence,
        labels,
        metadata: {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown'
        }
      };
    } catch (error) {
      logger.error('Image extraction failed:', error);
      throw error;
    }
  }

  // Extract text from PDF
  async extractFromPdf(pdfUrl: string): Promise<PdfExtractionResult> {
    try {
      // Download PDF if URL
      let pdfBuffer: Buffer;
      
      if (pdfUrl.startsWith('http')) {
        const response = await axios.get(pdfUrl, {
          responseType: 'arraybuffer',
          timeout: 30000
        });
        pdfBuffer = Buffer.from(response.data);
      } else {
        pdfBuffer = Buffer.from(pdfUrl, 'base64');
      }

      // Parse PDF
      const result = await pdf(pdfBuffer);

      return {
        text: result.text,
        pages: result.numpages,
        metadata: {
          title: result.info?.Title,
          author: result.info?.Author,
          creationDate: result.info?.CreationDate ? new Date(result.info.CreationDate) : undefined
        }
      };
    } catch (error) {
      logger.error('PDF extraction failed:', error);
      throw error;
    }
  }

  // Extract frames from video
  async extractFromVideo(videoUrl: string): Promise<VideoExtractionResult> {
    // This is a placeholder - in production, you'd use ffmpeg or similar
    logger.warn('Video extraction not fully implemented');
    
    return {
      frames: [],
      duration: 0
    };
  }

  // Analyze image with Google Vision API
  private async analyzeImageWithVision(imageUrl: string): Promise<string[]> {
    try {
      const vision = require('@google-cloud/vision');
      const client = new vision.ImageAnnotatorClient({
        keyFilename: config.vision.googleVisionApiKey
      });

      const [result] = await client.labelDetection(imageUrl);
      const labels = result.labelAnnotations || [];

      return labels.map((label: any) => label.description);
    } catch (error) {
      logger.warn('Google Vision API failed:', error);
      return [];
    }
  }

  // Preprocess image for better OCR
  private async preprocessImage(buffer: Buffer): Promise<Buffer> {
    try {
      // Convert to grayscale and enhance contrast
      return await sharp(buffer)
        .grayscale()
        .normalize()
        .sharpen()
        .toBuffer();
    } catch (error) {
      logger.warn('Image preprocessing failed, using original:', error);
      return buffer;
    }
  }

  // Extract structured data from image using LLM
  async extractStructuredFromImage(
    imageUrl: string,
    schema: Record<string, string>
  ): Promise<Record<string, any>> {
    try {
      // First get OCR text
      const ocrResult = await this.extractFromImage(imageUrl);

      // Use LLM to structure the data
      const prompt = `Extract structured data from the following OCR text:

OCR Text: "${ocrResult.text}"

Extract the following fields:
${Object.entries(schema).map(([key, desc]) => `- ${key}: ${desc}`).join('\n')}

Return as JSON.`;

      const response = await llmService.generateJSON<Record<string, any>>(prompt, {
        temperature: 0.1
      });

      return response.content;
    } catch (error) {
      logger.error('Structured image extraction failed:', error);
      throw error;
    }
  }

  // Batch process multiple images
  async batchExtractImages(imageUrls: string[]): Promise<ImageExtractionResult[]> {
    const results: ImageExtractionResult[] = [];

    for (const url of imageUrls) {
      try {
        const result = await this.extractFromImage(url);
        results.push(result);
      } catch (error) {
        logger.error(`Failed to extract from ${url}:`, error);
        results.push({
          text: '',
          confidence: 0,
          metadata: { width: 0, height: 0, format: 'unknown' }
        });
      }
    }

    return results;
  }

  // Detect if content is image, PDF, or video
  detectContentType(url: string, contentType?: string): 'image' | 'pdf' | 'video' | 'unknown' {
    if (contentType) {
      if (contentType.startsWith('image/')) return 'image';
      if (contentType === 'application/pdf') return 'pdf';
      if (contentType.startsWith('video/')) return 'video';
    }

    // Detect from URL extension
    const lowerUrl = url.toLowerCase();
    if (/\.(jpg|jpeg|png|gif|webp|bmp|svg)$/.test(lowerUrl)) return 'image';
    if (/\.pdf$/.test(lowerUrl)) return 'pdf';
    if (/\.(mp4|avi|mov|wmv|flv|webm)$/.test(lowerUrl)) return 'video';

    return 'unknown';
  }

  // Extract from any URL (auto-detect type)
  async extractFromUrl(url: string): Promise<any> {
    try {
      // Try to get content type from HEAD request
      let contentType: string | undefined;
      try {
        const headResponse = await axios.head(url, { timeout: 10000 });
        contentType = headResponse.headers['content-type'];
      } catch {
        // Ignore HEAD errors
      }

      const type = this.detectContentType(url, contentType);

      switch (type) {
        case 'image':
          return await this.extractFromImage(url);
        case 'pdf':
          return await this.extractFromPdf(url);
        case 'video':
          return await this.extractFromVideo(url);
        default:
          throw new Error(`Unsupported content type: ${contentType || 'unknown'}`);
      }
    } catch (error) {
      logger.error('Multi-modal extraction failed:', error);
      throw error;
    }
  }
}

export const multiModalService = MultiModalService.getInstance();
