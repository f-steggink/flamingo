/*
 * B3P Kaartenbalie is a OGC WMS/WFS proxy that adds functionality
 * for authentication/authorization, pricing and usage reporting.
 *
 * Copyright 2006, 2007, 2008 B3Partners BV
 * 
 * This file is part of B3P Kaartenbalie.
 * 
 * B3P Kaartenbalie is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * B3P Kaartenbalie is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with B3P Kaartenbalie.  If not, see <http://www.gnu.org/licenses/>.
 */
package nl.b3p.viewer.image;

import com.sun.imageio.plugins.png.PNGMetadata;
import com.vividsolutions.jts.geom.Geometry;
import com.vividsolutions.jts.geom.GeometryFactory;
import com.vividsolutions.jts.geom.Polygon;
import com.vividsolutions.jts.geom.PrecisionModel;
import com.vividsolutions.jts.io.ParseException;
import com.vividsolutions.jts.io.WKTReader;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.Rectangle;
import java.awt.RenderingHints;
import java.awt.Shape;
import java.awt.geom.AffineTransform;
import java.awt.geom.Ellipse2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import javax.imageio.ImageIO;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.ImageOutputStream;
import org.apache.commons.httpclient.HttpMethod;
import org.apache.commons.logging.Log;
import org.apache.commons.logging.LogFactory;
import org.geotools.geometry.jts.LiteShape;
import org.geotools.geometry.jts.ReferencedEnvelope;
import org.geotools.referencing.CRS;
import org.geotools.renderer.lite.RendererUtilities;

public class ImageTool {

    private static final Log log = LogFactory.getLog(ImageTool.class);
    private BufferedImage bi;
    public static final String TIFF = "image/tiff";
    public static final String GIF = "image/gif";
    public static final String JPEG = "image/jpeg";
    public static final String PNG = "image/png";

    /** Reads an image from an http input stream.
     *
     * @param method Apache HttpClient GetMethod object
     * @param mime String representing the mime type of the image.
     *
     * @return BufferedImage
     *
     * @throws Exception
     */
    // <editor-fold defaultstate="" desc="readImage(GetMethod method, String mime) method.">
    public static BufferedImage readImage(HttpMethod method, String mime) throws Exception {
        ImageReader ir = null;
        BufferedImage i = null;
        try {
            if (mime.indexOf(";") != -1) {
                mime = mime.substring(0, mime.indexOf(";"));
            }
            String mimeType = getMimeType(mime);
            
            /* TODO: Kijken waarom er geen mime type meer binnenkomt. Wellicht door de 
             * HttpClient vernieuwing in kaartenbalie ? */
            if (mimeType == null) {
                mimeType = "image/png";
            }
            
            if (mimeType == null) {
                log.error("Response from server not understood (mime = " + mime + "): " + method.getResponseBodyAsString());
                throw new Exception("Response from server not understood (mime = " + mime + "): " + method.getResponseBodyAsString());
            }

            ir = getReader(mimeType);
            if (ir == null) {
                log.error("no reader available for imageformat: " + mimeType.substring(mimeType.lastIndexOf("/") + 1));
                throw new Exception("no reader available for imageformat: " + mimeType.substring(mimeType.lastIndexOf("/") + 1));
            }
            //TODO Make smarter.. Possibly faster... But keep reporting!
            InputStream is = method.getResponseBodyAsStream();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            int bytesRead = 0;
            byte[] buffer = new byte[2048];
            while (bytesRead != -1) {
                bytesRead = is.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    baos.write(buffer, 0, bytesRead);
                }
            }
            ImageInputStream stream = ImageIO.createImageInputStream(new ByteArrayInputStream(baos.toByteArray()));
            ir.setInput(stream, true);
            i = ir.read(0);
            //if image is a png, has no alpha and has a tRNS then make that color transparent.
            if (!i.getColorModel().hasAlpha() && ir.getImageMetadata(0) instanceof PNGMetadata) {
                PNGMetadata metadata = (PNGMetadata) ir.getImageMetadata(0);
                if (metadata.tRNS_present) {
                    int alphaPix = (metadata.tRNS_red << 16) | (metadata.tRNS_green << 8) | (metadata.tRNS_blue);
                    BufferedImage tmp = new BufferedImage(i.getWidth(), i.getHeight(),
                            BufferedImage.TYPE_INT_ARGB);
                    for (int x = 0; x < i.getWidth(); x++) {
                        for (int y = 0; y < i.getHeight(); y++) {
                            int rgb = i.getRGB(x, y);
                            rgb = (rgb & 0xFFFFFF) == alphaPix ? alphaPix : rgb;
                            tmp.setRGB(x, y, rgb);
                        }
                    }
                    i = tmp;
                }
            }
        } finally {
            if (ir != null) {
                ir.dispose();
            }
        }
        return i;
    }
    // </editor-fold>

    /** First combines the given images to one image and then sends this image back to the client.
     *
     * @param images BufferedImage array with the images tha have to be combined and sent to the client.
     * @param mime String representing the mime type of the image.
     * @param dw DataWrapper object in which the request object is stored.
     *
     * @throws Exception
     */
    // <editor-fold defaultstate="" desc="writeImage(BufferedImage [] images, String mime, DataWrapper dw) method.">
    public static void writeImage(BufferedImage image, String mime, OutputStream os) throws Exception {

        String mimeType = getMimeType(mime);
        if (mimeType == null) {
            log.error("unsupported mime type: " + mime);
            throw new Exception("unsupported mime type: " + mime);
        }

        if (mime.equals(TIFF)) {
            writeTIFFImage(image, os);
        } else {
            writeOtherImage(image, os, mimeType.substring(mimeType.lastIndexOf("/") + 1));
        }
    }

    public static BufferedImage drawGeometries(BufferedImage bi, CombineImageSettings settings) throws Exception {
        int srid = 28992;
        if (settings.getSrid() != null) {
            srid = ((int) settings.getSrid());
        }
        int width = 500;
        int height = 500;
        ImageBbox imbbox = settings.getRequestBbox();
        if (imbbox.getWidth() != null && imbbox.getHeight() != null) {
            width = imbbox.getWidth();
            height = imbbox.getHeight();
        } else {
            Integer[] hw = settings.getWidthAndHeightFromUrls();
            if (hw != null && hw.length == 2) {
                width = hw[0];
                height = hw[1];
            }
        }
        Bbox bbox = imbbox.getBbox();
        if (bbox == null) {
            bbox = settings.getBbox();
        }
        if (bbox == null) {
            bbox = settings.getBboxFromUrls();
        }
        if (bbox == null) {
            log.error("No BBOX found");
            throw new Exception("Can't find bbox in settings or URL");
        }
        return drawGeometries(bi, settings, srid, bbox, width, height);

    }

    public static BufferedImage drawGeometries(BufferedImage bi, CombineImageSettings settings, int srid, Bbox bbox, int width, int height) throws Exception {
        List wktGeoms = settings.getWktGeoms();
        if (wktGeoms == null || wktGeoms.size() <= 0) {
            return bi;
        }
        BufferedImage newBufIm = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB_PRE);
//        BufferedImage newBufIm = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D gbi = newBufIm.createGraphics();
        gbi.drawImage(bi, 0, 0, null);
        for (int i = 0; i < wktGeoms.size(); i++) {
            gbi.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.5f));
            CombineImageWkt ciw = (CombineImageWkt) wktGeoms.get(i);
            Color color = settings.getDefaultWktGeomColor();
            if (ciw.getColor() != null) {
                color = ciw.getColor();
            }
            gbi.setColor(color);
            String wktGeom = ciw.getWktGeom();
            Geometry geom = geometrieFromText(wktGeom, srid);
            Shape shape = createImage(geom, srid, bbox, width, height);
            Point centerPoint = null;
            if (geom instanceof Polygon) {
                gbi.fill(shape);
            } else if (geom instanceof com.vividsolutions.jts.geom.Point) {
                centerPoint = calculateCenter(shape, srid, bbox, width, height);
                gbi.fill(new Ellipse2D.Double(centerPoint.getX(), centerPoint.getY(), 8, 8));
            } else {
                float strokeWidth = ciw.getStrokeWidth() != null ? ciw.getStrokeWidth() : 3f;
                gbi.setStroke(new BasicStroke(strokeWidth));
                gbi.draw(shape);
            }
            if (ciw.getLabel() != null) {
                if (centerPoint == null) {
                    centerPoint = calculateCenter(shape, srid, bbox, width, height);
                }
                gbi.setColor(Color.black);
                gbi.drawString(ciw.getLabel(), (float) centerPoint.getX(), (float) centerPoint.getY());
            }
        }
        gbi.dispose();
        return newBufIm;
    }

    private static Point calculateCenter(Shape shape, int srid, Bbox bbox, int width, int height) throws Exception {
        Point centerPoint = new Point();
        double x = shape.getBounds2D().getCenterX();
        double y = shape.getBounds2D().getCenterY();
        centerPoint.setLocation(x, y);
        centerPoint = transformToScreen(centerPoint, srid, bbox, width, height);
        return centerPoint;
    }

    public static Shape createImage(Geometry geometrie, int bboxSrid, Bbox bbox, int width, int height) throws Exception {
        ReferencedEnvelope re = new ReferencedEnvelope(bbox.getMinx(), bbox.getMaxx(), bbox.getMiny(), bbox.getMaxy(), CRS.decode("EPSG:" + bboxSrid));
        AffineTransform transform = RendererUtilities.worldToScreenTransform(re, new Rectangle(width, height));
        LiteShape ls = new LiteShape(geometrie, transform, false);
        return ls;
    }

    public static Point transformToScreen(Point source, int bboxSrid, Bbox bbox, int width, int height) throws Exception {
        ReferencedEnvelope re = new ReferencedEnvelope(bbox.getMinx(), bbox.getMaxx(), bbox.getMiny(), bbox.getMaxy(), CRS.decode("EPSG:" + bboxSrid));
        AffineTransform transform = RendererUtilities.worldToScreenTransform(re, new Rectangle(width, height));
        Point result = new Point();
        transform.transform(source, result);
        return result;
    }

    public static Geometry geometrieFromText(String wktgeom, int srid) {
        WKTReader wktreader = new WKTReader(new GeometryFactory(new PrecisionModel(), srid));
        try {
            Geometry geom = wktreader.read(wktgeom);
            return geom;
        } catch (ParseException p) {
            log.error("Can't create geomtry from wkt: " + wktgeom, p);
        }
        return null;
    }

    // </editor-fold>
    /** Writes a TIFF image to the outputstream.
     *
     * @param bufferedImage BufferedImage created from the given images.
     * @param dw DataWrapper object in which the request object is stored.
     *
     * @throws Exception
     */
    // <editor-fold defaultstate="" desc="getOnlineData(DataWrapper dw, ArrayList urls, boolean overlay, String REQUEST_TYPE) method.">
    private static void writeTIFFImage(BufferedImage bufferedImage, OutputStream os) throws Exception {
        //log.info("Writing TIFF using ImageIO.write");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(bufferedImage, "tif", baos);
        os.write(baos.toByteArray());
    }
    // </editor-fold>

    /** Writes a JPEG, GIF or PNG image to the outputstream.
     *
     * @param bufferedImage BufferedImage created from the given images.
     * @param dw DataWrapper object in which the request object is stored.
     * @param extension String with the extension of the file
     *
     * @throws Exception
     */
    // <editor-fold defaultstate="" desc="writeOtherImage(BufferedImage bufferedImage, DataWrapper dw, String extension) method.">
    private static void writeOtherImage(BufferedImage bufferedImage, OutputStream os, String extension) throws Exception {
        //log.info("Writing JPG, GIF or PNG using ImageIO.write");
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageOutputStream ios = ImageIO.createImageOutputStream(baos);
        ImageIO.write(bufferedImage, extension, ios);
        os.write(baos.toByteArray());
        ios.flush();
        ios.close();
    }
    // </editor-fold>
    /** Method which handles the combining of the images. This method redirects to the right method
     * for the different images, since not every image can be combined in the same way.
     *
     * @param images BufferedImage array with the images tha have to be combined.
     * @param mime String representing the mime type of the image.
     * @param width the width of the result image (or null if the width of the first image must be used)
     * @param height the height of the result image (or null if the width of the first image must be used)
     * @return BufferedImage
     */
    public static BufferedImage combineImages(List<ReferencedImage> images, String mime, Integer width, Integer height) {
        if (mime.equals(JPEG)) {
            return combineJPGImages(images, width, height);
        } else {
            return combineOtherImages(images, width, height);
        }
    }
    // </editor-fold>

    /** Combines JPG images. Combining JPG images is different from the other image types since JPG
     * has to use an other imageType: BufferedImage.TYPE_INT_RGB.
     *
     * @param images the referenced Images
     * @param width the width of the result image (or null if the width of the first image must be used)
     * @param height the height of the result image (or null if the width of the first image must be used)
     *
     * @return BufferedImage
     */
    private static BufferedImage combineJPGImages(List<ReferencedImage> images,Integer width, Integer height) {
        if (images.get(0)!=null){
        BufferedImage bi = images.get(0).getImage();
            if (width==null){
                width = bi.getWidth();
            }
            if (height==null){
                height = bi.getHeight();
            }
        }

        BufferedImage newBufIm = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D gbi = newBufIm.createGraphics();
        for (ReferencedImage image : images) {
            drawImage(gbi,image);
        }
        return newBufIm;
    }

    /** Combines GIF, TIFF or PNG images. Combining these images is different from the JPG image types since these
     * has to use an other imageType: BufferedImage.TYPE_INT_ARGB_PRE.
     *
     * @param images the referenced Images
     * @param width the width of the result image (or null if the width of the first image must be used)
     * @param height the height of the result image (or null if the width of the first image must be used)
     *
     * @return BufferedImage
     */
    private static BufferedImage combineOtherImages(List<ReferencedImage> images,Integer width, Integer height) {
        if (images.get(0)!=null){
            BufferedImage bi = images.get(0).getImage();
            //if no height / width use the height/widht of the first image.
            if (height==null){
                height= bi.getHeight();
            }
            if (width==null){
                width= bi.getWidth();
            }
        }
        
        BufferedImage newBufIm = new BufferedImage(width, height, BufferedImage.TYPE_INT_ARGB_PRE);        
        
        Graphics2D gbi = newBufIm.createGraphics();
        gbi.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

        for (int i = 0; i < images.size(); i++) {
            ReferencedImage image =images.get(i);
            drawImage(gbi,image);
        }
        return newBufIm;
    }
    /**
     * Draws the image to the graphics object.
     * @param gbi graphics object
     * @param image the referenced image.
     */
    private static void drawImage(Graphics2D gbi, ReferencedImage image){
        if (image.getAlpha()!=null){
            gbi.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, image.getAlpha() ));
        }else {
            gbi.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 1.0f));
        }
        Integer x=image.getX();
        Integer y=image.getY();
        if (x==null){
            x=0;
        }if (y==null){
            y=0;
        }
        if (image.getHeight()!=null && image.getWidth()!=null){
            gbi.drawImage(image.getImage(), x, y, image.getWidth(),image.getHeight(),null);        
        }else{
            gbi.drawImage(image.getImage(), x, y, null);        
        }
    }
    // </editor-fold>

    /** Private method which seeks through the supported MIME types to check if
     * a certain MIME is supported.
     *
     * @param mime String with the MIME to find.
     *
     * @return a String with the found MIME or null if no MIME was found.
     */
    // <editor-fold defaultstate="" desc="getMimeType(String mime) method.">
    public static String getMimeType(String mime) {
        /*Crap ESRI, image/jpg is not a content type, needs to be image/jpeg*/
        if ("image/jpg".equalsIgnoreCase(mime)){
            mime="image/jpeg";
        }        
        String[] mimeTypes = ImageIO.getReaderMIMETypes();
        for (int i = 0; i < mimeTypes.length; i++) {
            if (mimeTypes[i].equalsIgnoreCase(mime)) {
                return mimeTypes[i];
            }
        }
        return null;
    }
    // </editor-fold>

    /** Private method which seeks through the supported image readers to check if
     * a there is a reader which handles the specified MIME.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageReader which can handle the specified MIME or null if no reader was found.
     */
    // <editor-fold defaultstate="" desc="getReader(String mime) method.">
    private static ImageReader getReader(String mime) {
        if (mime.equals(JPEG) || mime.equals(PNG)) {
            return getJPGOrPNGReader(mime);
        } else {
            return getGIFOrTIFFReader(mime);
        }
    }
    // </editor-fold>

    /** Private method which seeks through the supported image readers to check if
     * a there is a reader which handles the specified MIME. This method checks spe-
     * cifically for JPG or PNG images because Sun's Java supports two kind of readers
     * for these particular formats. And because one of these readers doesn't function
     * well, we need to be sure we have the right reader.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageReader which can handle the specified MIME or null if no reader was found.
     */
    // <editor-fold defaultstate="" desc="getJPGOrPNGReader(String mime) method.">
    private static ImageReader getJPGOrPNGReader(String mime) {
        Iterator it = ImageIO.getImageReadersByMIMEType(mime);
        ImageReader imTest = null;
        String name = null;
        while (it.hasNext()) {
            imTest = (ImageReader) it.next();
            name = imTest.getClass().getPackage().getName();
            String generalPackage = name.substring(0, name.lastIndexOf("."));
            if (generalPackage.equalsIgnoreCase("com.sun.media.imageioimpl.plugins")) {
                continue;
            }
        }
        //log.info("Using ImageReader: " + name);
        return imTest;
    }
    // </editor-fold>

    /** Private method which seeks through the supported image readers to check if
     * a there is a reader which handles the specified MIME. This method checks spe-
     * cifically for GIF or TIFF images.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageReader which can handle the specified MIME or null if no reader was found.
     */
    // <editor-fold defaultstate="" desc="getGIFOrTIFFReader(String mime) method.">
    private static ImageReader getGIFOrTIFFReader(String mime) {
        Iterator it = ImageIO.getImageReadersByMIMEType(mime);
        ImageReader imTest = null;
        String name = null;
        while (it.hasNext()) {
            imTest = (ImageReader) it.next();
            name = imTest.getClass().getPackage().getName();
        }
        //log.info("Using ImageReader: " + name);
        return imTest;
    }
    // </editor-fold>

    /** Private method which seeks through the supported image writers to check if
     * a there is a writers which handles the specified MIME.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageWriter which can handle the specified MIME or null if no writer was found.
     */
    // <editor-fold defaultstate="" desc="getWriter(String mime) method.">
    private ImageWriter getWriter(String mime) {
        if (mime.equals(JPEG) || mime.equals(PNG)) {
            return getJPGOrPNGWriter(mime);
        } else {
            return getGIFOrTIFFWriter(mime);
        }
    }
    // </editor-fold>

    /** Private method which seeks through the supported image writers to check if
     * a there is a writers which handles the specified MIME. This method checks spe-
     * cifically for JPG or PNG images because Sun's Java supports two kind of writers
     * for these particular formats. And because one of these writers doesn't function
     * well, we need to be sure we have the right writers.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageWriter which can handle the specified MIME or null if no writer was found.
     */
    // <editor-fold defaultstate="" desc="getJPGOrPNGWriter(String mime) method.">
    private ImageWriter getJPGOrPNGWriter(String mime) {
        Iterator it = ImageIO.getImageReadersByMIMEType(mime);
        ImageWriter imTest = null;
        while (it.hasNext()) {
            imTest = (ImageWriter) it.next();
            String name = imTest.getClass().getPackage().getName();
            String generalPackage = name.substring(0, name.lastIndexOf("."));
            if (generalPackage.equalsIgnoreCase("com.sun.media.imageioimpl.plugins")) {
                continue;
            }
        }
        return imTest;
    }
    // </editor-fold>

    /** Private method which seeks through the supported image writers to check if
     * a there is a writers which handles the specified MIME. This method checks spe-
     * cifically for GIF or TIFF images.
     *
     * @param mime String with the MIME to find.
     *
     * @return ImageWriter which can handle the specified MIME or null if no writer was found.
     */
    // <editor-fold defaultstate="" desc="getGIFOrTIFFWriter(String mime) method.">
    private ImageWriter getGIFOrTIFFWriter(String mime) {
        Iterator it = ImageIO.getImageReadersByMIMEType(mime);
        ImageWriter imTest = null;
        while (it.hasNext()) {
            imTest = (ImageWriter) it.next();
        }
        return imTest;
    }

    /**
     *
     */
    public static BufferedImage changeColor(BufferedImage im, Color color, Color newColor) {
        for (int x = 0; x < im.getWidth(); x++) {
            for (int y = 0; y < im.getHeight(); y++) {
                if (im.getRGB(x, y) == color.getRGB()) {
                    im.setRGB(x, y, newColor.getRGB());
                }
            }
        }
        return im;
    }
    // </editor-fold>
}
