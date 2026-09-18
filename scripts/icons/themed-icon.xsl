<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:svg="http://www.w3.org/2000/svg"
  xmlns="http://www.w3.org/2000/svg"
  exclude-result-prefixes="svg">
  <xsl:param name="color" select="'currentColor'"/>
  <xsl:output method="xml" encoding="UTF-8" omit-xml-declaration="yes"/>

  <xsl:template match="/svg:svg">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="{$color}">
      <xsl:apply-templates select="node()"/>
    </svg>
  </xsl:template>

  <xsl:template match="@fill|style"/>

  <xsl:template match="@*|node()">
    <xsl:copy>
      <xsl:apply-templates select="@*|node()"/>
    </xsl:copy>
  </xsl:template>
</xsl:stylesheet>
