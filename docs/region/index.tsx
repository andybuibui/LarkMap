import { CopyOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ChoroplethLayerProps, LarkMapProps, LayerPopupProps } from '@antv/larkmap';
import { ChoroplethLayer, CustomControl, LarkMap, LayerPopup, MapThemeControl } from '@antv/larkmap';
import { Button, Checkbox, Collapse, message, Popover, Select, Spin } from 'antd';
import React, { useEffect, useMemo, useState } from 'react';
import { DataVSource, L7Source } from './data';
import type { DataPrecision } from './data/BaseDataSource';
import './index.less';
import {
  accuracyOption,
  bulkDownload,
  cityValue,
  copy,
  downloadData,
  getDrillingData,
  gitRollupData,
  item,
  sourceOptions,
} from './util';

const { Panel } = Collapse;

const layerOptions: Omit<ChoroplethLayerProps, 'source'> = {
  autoFit: true,
  fillColor: '#377eb8',
  opacity: 0.3,
  strokeColor: 'blue',
  lineWidth: 0.5,
  state: {
    active: { strokeColor: 'green', lineWidth: 1.5, lineOpacity: 0.8 },
    select: { strokeColor: 'red', lineWidth: 1.5, lineOpacity: 0.8 },
  },
};

const config: LarkMapProps = {
  mapType: 'Gaode',
  mapOptions: {
    style: 'light',
    center: [120.210792, 30.246026],
    zoom: 9,
  },
};

export default () => {
  const [source, setSource] = useState({
    data: { type: 'FeatureCollection', features: [] },
    parser: { type: 'geojson' },
  });
  const [adcode, setAdcode] = useState({
    code: 100000,
    adcode: 10000,
    level: 'country',
    GID_1: undefined,
    GID_2: undefined,
  });
  const [newL7Source, setNewL7Source] = useState<L7Source>(new L7Source({ version: 'xinzhengqu' }));
  const [sourceValue, setSourceValue] = useState('thirdParty');
  const [loading, setLoading] = useState(false);
  const [accuracyValue, setAccuracyVAlue] = useState<DataPrecision>('low');
  const [clickData, setClickData] = useState(undefined);
  const [CheckValue, setCheckboxValue] = useState([]);

  // @ts-ignore
  useEffect(async () => {
    setLoading(true);
    if (newL7Source) {
      const data = await newL7Source.getData({ level: 'country', code: 100000, full: true });
      const jiuduanxian = await newL7Source.getData({ level: 'jiuduanxian' });
      console.log(jiuduanxian);
      setSource((prevState) => ({
        ...prevState,
        data: { type: data.type, features: data.features },
      }));
    }
    setLoading(false);
  }, [sourceValue]);

  useEffect(() => {
    console.log(adcode.level);
  }, [adcode.level]);

  const onDblClick = async (e: any) => {
    setLoading(true);
    if (adcode.level !== 'district') {
      const L7Code = e.feature.properties?.FIRST_GID
        ? e.feature.properties?.FIRST_GID
        : e.feature.properties?.code
        ? e.feature.properties?.code
        : 100000;
      const dataVCode = e.feature.properties?.adcode;
      const data = {
        dataV: {
          code: dataVCode,
          parentCode: e.feature.properties?.parent?.adcode
            ? e.feature.properties?.parent?.adcode
            : e.feature.properties?.parent
            ? JSON.parse(e.feature.properties?.parent)?.adcode
            : undefined,
          full: adcode.level !== 'city' ? true : false,
        },
        thirdParty: {
          code: L7Code,
          parentCode: L7Code,
          full: undefined,
        },
      };
      const datas = await getDrillingData(newL7Source, data[sourceValue].code, data[sourceValue].full, adcode.level);

      const dataLevel = {
        dataV: e.feature.properties.level,
        thirdParty: datas.level,
      };
      setSource((prevState) => ({ ...prevState, data: datas.GeoJSON }));
      setAdcode((state) => ({
        ...state,
        code: data[sourceValue].parentCode,
        adcode: data[sourceValue].code,
        level: dataLevel[sourceValue],
        GID_1: e.feature.properties.GID_1,
        GID_2: e.feature.properties.GID_2,
      }));
    } else {
      message.info('已下钻到最后一层');
    }
    setClickData(undefined);
    setCheckboxValue([]);
    setLoading(false);
  };

  const onUndblclick = async () => {
    setLoading(true);
    if (adcode.level === 'country') {
      message.info('已经上钻到最上层级');
    } else {
      const type = {
        dataV: true,
        thirdParty: false,
      };
      const data = await gitRollupData({
        L7Source: newL7Source,
        code: adcode.code,
        type: type[sourceValue],
        areaLevel: adcode.level,
        GID_1: adcode.GID_1,
      });

      setSource((prevState) => ({ ...prevState, data: data.geoJson }));
      setAdcode({ code: data.code, level: data.areaLevel, GID_1: data?.GID_1, GID_2: data?.GID_2, adcode: data.code });
    }
    setClickData(undefined);
    setCheckboxValue([]);
    setLoading(false);
  };

  const handleChange = (e) => {
    const data = {
      dataV: new DataVSource({ version: 'areas_v3' }),
      thirdParty: new L7Source({ version: 'xinzhengqu' }),
    };
    setNewL7Source(data[e]);
    setAdcode((state) => ({ ...state, code: 100000, level: 'country' }));
    setSourceValue(e);
  };

  const onDownload = async () => {
    message.info('数据下载中');
    const data = await downloadData(newL7Source, adcode.code, accuracyValue, adcode.level);
    const download = document.createElement('a');
    download.download = `${adcode.adcode}.json`;
    download.href = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(sourceValue === 'dataV' ? source.data : data),
    )}`;
    download.target = '_blank';
    download.rel = 'noreferrer';
    download.click();
    message.success('数据下载完成');
  };

  const onAccuracyChange = (e) => {
    setAccuracyVAlue(e);
  };

  const items: LayerPopupProps['items'] = useMemo(() => {
    return item(sourceValue, adcode.level);
  }, [sourceValue, adcode.level]);

  const onLayerClick = (e) => {
    if (sourceValue === 'thirdParty') {
      const L7code = e.feature.properties.FIRST_GID
        ? e.feature.properties.FIRST_GID
        : e.feature.properties.code
        ? e.feature.properties.code
        : 100000;
      setClickData({
        geojson: e.feature,
        name: e.feature.properties.ENG_NAME,
        code: L7code,
      });
    } else {
      setClickData({
        geojson: e.feature,
        name: e.feature.properties.name,
        code: e.feature.properties.adcode,
      });
    }
  };

  const content = (
    <div>
      <p>点击下载当前层级对应上级数据</p>
    </div>
  );

  const granularity = useMemo(() => {
    return cityValue(adcode.level);
  }, [adcode.level]);

  const onCheckChange = (e) => {
    setCheckboxValue(e);
  };

  const clickDownload = () => {
    if (sourceValue === 'thirdParty') {
      CheckValue.forEach(async (level: any) => {
        const data = await newL7Source.getChildrenData({
          parentName: clickData.code,
          parentLevel: adcode.level,
          childrenLevel: level,
          shineUpon: {
            country: '',
            province: 'GID_1',
            city: 'GID_2',
          },
        });
        bulkDownload(data, level);
      });
      bulkDownload(clickData.geojson, adcode.level);
    } else {
      bulkDownload(clickData.geojson, clickData.name);
    }
  };

  return (
    <Spin spinning={loading}>
      <div style={{ display: 'flex' }}>
        <LarkMap {...config} style={{ height: '90vh', width: 'calc(100% - 300px)' }}>
          <ChoroplethLayer
            {...layerOptions}
            source={source}
            onDblClick={onDblClick}
            onUndblclick={onUndblclick}
            onClick={onLayerClick}
            id="myChoroplethLayer"
          />
          <LayerPopup closeButton={false} closeOnClick={false} anchor="bottom-left" trigger="hover" items={items} />
          <MapThemeControl position="topleft" />
          <CustomControl
            position="bottomleft"
            className="custom-control-class"
            style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', padding: 16 }}
          >
            <div>下钻: 双击要下钻的区域</div>
            <div>下卷: 双击要上卷的区域</div>
          </CustomControl>
        </LarkMap>
        <div className="panel">
          <div className="source-select">
            <div>数据源：</div>
            <Select value={sourceValue} style={{ width: 150 }} onChange={handleChange} options={sourceOptions} />
          </div>
          {clickData && (
            <Collapse defaultActiveKey={['1']} ghost style={{ paddingTop: '12px' }}>
              <Panel header="下载选中数据" key="1">
                {sourceValue === 'thirdParty' && (
                  <div style={{ display: 'flex' }}>
                    <div>数据粒度选择：</div>
                    <Checkbox.Group options={granularity} onChange={onCheckChange} />
                  </div>
                )}
                <div style={{ display: 'flex' }}>
                  <div>选中名称：</div>
                  <div>{clickData.name}</div>
                </div>
                <div style={{ display: 'flex' }}>
                  <div>选中城市编码：</div>
                  <Popover content={'点击下载选中数据'}>
                    <a onClick={clickDownload}>{clickData.code}</a>
                  </Popover>
                </div>
              </Panel>
            </Collapse>
          )}
          {sourceValue === 'thirdParty' && (
            <Collapse defaultActiveKey={['1']} ghost style={{ paddingTop: '12px' }}>
              <Panel header="高级设置" key="1">
                <div className="flexCenter">
                  <div>数据精度：</div>
                  <Select
                    style={{ width: 120 }}
                    value={accuracyValue}
                    onChange={onAccuracyChange}
                    options={accuracyOption}
                  />
                </div>
              </Panel>
            </Collapse>
          )}
          <div className="download-content">
            <div style={{ marginRight: 10 }}>数据下载</div>
            <div className="data-input">
              <Popover content={'复制'}>
                <Button onClick={() => copy(JSON.stringify(source.data))}>
                  <CopyOutlined />
                </Button>
              </Popover>
              <Popover content={'下载当前层级全部数据'}>
                <Button onClick={onDownload}>
                  <DownloadOutlined />
                </Button>
              </Popover>
            </div>
          </div>
          <div className="originData" style={{}}>
            <div>数据来源：</div>
            {sourceValue === 'dataV' ? (
              <a href="https://datav.aliyun.com/portal/school/atlas/area_selector">dataV.GeoAtlas官网</a>
            ) : (
              <div>
                <a href="https://github.com/ruiduobao/shengshixian.com">GitHub</a>
              </div>
            )}
          </div>
        </div>
      </div>
    </Spin>
  );
};