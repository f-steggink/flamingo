/*
 * Copyright (C) 2012 B3Partners B.V.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
package nl.b3p.geotools.data.arcims.axl;

import java.util.List;
import javax.xml.bind.annotation.XmlAccessType;
import javax.xml.bind.annotation.XmlAccessorType;
import javax.xml.bind.annotation.XmlElement;

/**
 *
 * @author Matthijs Laan
 */
@XmlAccessorType(XmlAccessType.FIELD)
public class AxlFeatures {
    
    @XmlElement(name="FEATURE")
    List<AxlFeature> features;

    @XmlElement(name="FEATURECOUNT")
    AxlFeatureCount featureCount;
    
    public List<AxlFeature> getFeatures() {
        return features;
    }

    public void setFeatures(List<AxlFeature> features) {
        this.features = features;
    }

    public AxlFeatureCount getFeatureCount() {
        return featureCount;
    }

    public void setFeatureCount(AxlFeatureCount featureCount) {
        this.featureCount = featureCount;
    }
}
