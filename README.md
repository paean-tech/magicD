# magicD(神奇魔芋)
i18n pick tool

### Getting Started

```
  npm install magicD
  npx magicD ./src
```

### Config
Create your config file **i18n.config.json**
```
{
  "moduleSourceName": "i18n",
  "format": {
    "funcList": ["t"]
  },
  "lngs": ["zh-CN", "en-GB"],
  "dest": ".i18n/{{lng}}/{{ns}}.json"
}
```
