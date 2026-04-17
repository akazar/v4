import React from 'react';
import {Redirect} from '@docusaurus/router';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';

export default function Home() {
  const {
    i18n: {currentLocale, defaultLocale},
  } = useDocusaurusContext();
  const localePath = currentLocale === defaultLocale ? '' : `/${currentLocale}`;
  return <Redirect to={`${localePath}/docs/intro`} />;
}
